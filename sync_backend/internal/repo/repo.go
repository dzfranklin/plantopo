package repo

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/jackc/pgx/v5"
)

type Repo struct {
	db db.Querier
}

func New(db db.Querier) *Repo {
	return &Repo{db: db}
}

func (r *Repo) GetMapSnapshot(
	ctx context.Context, mapId string,
) (schema.Changeset, error) {
	var bytes []byte
	err := r.db.QueryRow(ctx,
		`SELECT value FROM map_snapshots WHERE map_id = $1`, mapId,
	).Scan(&bytes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return schema.Changeset{}, nil
		}
		err := fmt.Errorf("error getting map snapshot (mapId is %s): %w", mapId, err)
		return schema.Changeset{}, err
	}

	value, err := unmarshalSnapshot(bytes)
	if err != nil {
		err := fmt.Errorf("error unmarshalling map snapshot (mapId is %s): %w", mapId, err)
		return schema.Changeset{}, err
	}

	return value, nil
}

func (r *Repo) SetMapSnapshot(
	ctx context.Context, mapId string, value schema.Changeset,
) error {
	bytes, err := marshalSnapshot(value)
	if err != nil {
		return fmt.Errorf("error marshalling map snapshot: %w", err)
	}

	_, err = r.db.Exec(ctx,
		`INSERT INTO map_snapshots (map_id, value)
			VALUES ($1, $2)
			ON CONFLICT (map_id) DO UPDATE SET value = $2`,
		mapId, bytes,
	)
	if err != nil {
		return fmt.Errorf("error setting map snapshot: %w", err)
	}

	return nil
}

func marshalSnapshot(snapshot schema.Changeset) ([]byte, error) {
	uncompressed, err := json.Marshal(snapshot)
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

func unmarshalSnapshot(value []byte) (schema.Changeset, error) {
	reader, err := gzip.NewReader(bytes.NewReader(value))
	if err != nil {
		return schema.Changeset{}, err
	}
	var uncompressed bytes.Buffer
	_, err = uncompressed.ReadFrom(reader)
	if err != nil {
		return schema.Changeset{}, err
	}
	var snapshot schema.Changeset
	err = json.Unmarshal(uncompressed.Bytes(), &snapshot)
	if err != nil {
		return schema.Changeset{}, err
	}
	return snapshot, nil
}
