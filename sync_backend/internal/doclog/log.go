package doclog

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"github.com/danielzfranklin/plantopo/api/sync_schema"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"go.uber.org/zap"
)

type Querier interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

func Load(ctx context.Context, logger *zap.Logger, db Querier, mapId string) (l *Log, err error) {
	defer func() {
		if err != nil {
			err = fmt.Errorf("failed to load %s from doclog table: %w", mapId, err)
		}
	}()

	var head uint64
	err = db.QueryRow(ctx, `SELECT generation_start FROM doclog_head WHERE map_id = $1`, mapId).Scan(&head)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	} else if err != nil {
		return
	}

	var entries []*Entry
	var rows pgx.Rows
	rows, err = db.Query(ctx, `SELECT generation_start, generation_end, changeset
		FROM doclog
		WHERE map_id = $1 AND generation_start >= $2
		ORDER BY generation_start`, mapId, head)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var entry Entry
		var changeset []byte
		if err = rows.Scan(&entry.GenerationStart, &entry.GenerationEnd, &changeset); err != nil {
			return
		}
		if entry.Changeset, err = deserData(changeset); err != nil {
			return
		}
		entries = append(entries, &entry)
	}
	if err = rows.Err(); err != nil {
		return
	}

	sl := logger.Sugar()
	sl.Infof("loaded %s from doclog table (%d entries)", mapId, len(entries))

	return &Log{
		mapId:   mapId,
		db:      db,
		entries: entries,
		l:       sl,
	}, nil
}

type Log struct {
	mapId   string
	db      Querier
	entries []*Entry
	l       *zap.SugaredLogger
}

type Entry struct {
	GenerationStart uint64 // inclusive
	GenerationEnd   uint64 // inclusive
	Changeset       *sync_schema.Changeset
}

func (l *Log) Len() int {
	return len(l.entries)
}

func (l *Log) Get() []*Entry {
	return l.entries
}

func (l *Log) Push(ctx context.Context, entry *Entry) (err error) {
	var changeset []byte
	if changeset, err = serData(entry.Changeset); err != nil {
		return
	}

	_, err = l.db.Exec(ctx, `INSERT INTO doclog
		(map_id, generation_start, generation_end, changeset)
		VALUES ($1, $2, $3, $4)`,
		l.mapId, entry.GenerationStart, entry.GenerationEnd, changeset)
	if err != nil {
		err = fmt.Errorf("failed to push %s entry [%d, %d] (%d bytes) to doclog table: %w",
			l.mapId, entry.GenerationStart, entry.GenerationEnd, len(changeset), err)
		return
	}

	l.entries = append(l.entries, entry)

	l.l.Infof("pushed %s entry [%d, %d] (%d bytes) to doclog table",
		l.mapId, entry.GenerationStart, entry.GenerationEnd, len(changeset))

	return
}

func (l *Log) Replace(ctx context.Context, entry *Entry) (err error) {
	var changeset []byte
	if changeset, err = serData(entry.Changeset); err != nil {
		return
	}

	var tx pgx.Tx
	if tx, err = l.db.Begin(ctx); err != nil {
		return
	}

	_, err = tx.Exec(ctx, `INSERT INTO doclog_head
		(map_id, generation_start) VALUES ($1, $2)
		ON CONFLICT (map_id)
		DO UPDATE SET generation_start = $2
		`, l.mapId, entry.GenerationStart)
	if err != nil {
		err = fmt.Errorf("failed to update doclog_head table %s to %d: %w",
			l.mapId, entry.GenerationStart, err)
		return
	}

	_, err = tx.Exec(ctx, `INSERT INTO doclog
		(map_id, generation_start, generation_end, changeset)
		VALUES ($1, $2, $3, $4)`,
		l.mapId, entry.GenerationStart, entry.GenerationEnd, changeset)
	if err != nil {
		err = fmt.Errorf("failed to push %s entry [%d, %d] (%d bytes) to doclog table in replace: %w",
			l.mapId, entry.GenerationStart, entry.GenerationEnd, len(changeset), err)
		return
	}

	if err = tx.Commit(ctx); err != nil {
		err = fmt.Errorf("failed to commit replace of %s to [%d, %d] (%d bytes]: %w",
			l.mapId, entry.GenerationStart, entry.GenerationEnd, len(changeset), err)
		return
	}

	l.entries = []*Entry{entry}

	l.l.Infof("replaced %s with entry [%d, %d] (%d bytes) in doclog table",
		l.mapId, entry.GenerationStart, entry.GenerationEnd, len(changeset))

	return
}

func serData(v *schema.Changeset) ([]byte, error) {
	uncompressed, err := v.MarshalJSON()
	if err != nil {
		return nil, err
	}
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	_, err = writer.Write(uncompressed)
	if err != nil {
		return nil, err
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}
	return compressed.Bytes(), nil
}

func deserData(value []byte) (*schema.Changeset, error) {
	reader, err := gzip.NewReader(bytes.NewReader(value))
	if err != nil {
		return nil, err
	}
	var uncompressed bytes.Buffer
	_, err = uncompressed.ReadFrom(reader)
	if err != nil {
		return nil, err
	}
	var snapshot schema.Changeset
	err = snapshot.UnmarshalJSON(uncompressed.Bytes())
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}
