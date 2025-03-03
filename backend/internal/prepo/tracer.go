package prepo

import (
	"context"
	"errors"
	"github.com/DataDog/go-sqllexer"
	"github.com/jackc/pgx/v5"
	"log/slog"
	"time"
)

func NewTracer(logger *slog.Logger) *Tracer {
	return &Tracer{logger}
}

type Tracer struct {
	l *slog.Logger
}

var normalizer = sqllexer.NewNormalizer()

type ctxKey int

const (
	_ ctxKey = iota
	traceQueryCtxKey
	traceBatchCtxKey
	traceCopyFromCtxKey
	traceConnectCtxKey
)

type traceQueryData struct {
	startTime time.Time
	sql       string
}

const slowQueryThreshold = time.Second

func (tl *Tracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	sql := data.SQL
	sql, _, err := normalizer.Normalize(sql)
	if err != nil {
		tl.l.Error("error normalizing SQL: %s", "err", err)
	}
	return context.WithValue(ctx, traceQueryCtxKey, &traceQueryData{
		startTime: time.Now(),
		sql:       sql,
	})
}

func (tl *Tracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	queryData := ctx.Value(traceQueryCtxKey).(*traceQueryData)

	endTime := time.Now()
	interval := endTime.Sub(queryData.startTime)

	if data.Err != nil && !errors.Is(data.Err, context.Canceled) {
		tl.l.Error("trace error", "err", data.Err, "sql", queryData.sql, "interval", interval)
		return
	}

	if interval > slowQueryThreshold {
		tl.l.Warn("slow query", "sql", queryData.sql, "interval", interval)
	}
}

type traceBatchData struct {
	startTime time.Time
	sql       map[string]int
}

func (tl *Tracer) TraceBatchStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceBatchStartData) context.Context {
	sql := make(map[string]int)
	for _, q := range data.Batch.QueuedQueries {
		s := q.SQL
		s, _, err := normalizer.Normalize(s)
		if err != nil {
			tl.l.Error("error normalizing SQL", "err", err)
		}

		sql[s] += 1
	}

	return context.WithValue(ctx, traceBatchCtxKey, &traceBatchData{
		startTime: time.Now(),
		sql:       sql,
	})
}

func (tl *Tracer) TraceBatchQuery(_ context.Context, _ *pgx.Conn, data pgx.TraceBatchQueryData) {
	if data.Err != nil {
		tl.l.Error("trace error: BatchQuery", "err", data.Err, "sql", data.SQL)
		return
	}
}

func (tl *Tracer) TraceBatchEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceBatchEndData) {
	queryData := ctx.Value(traceBatchCtxKey).(*traceBatchData)

	endTime := time.Now()
	interval := endTime.Sub(queryData.startTime)

	if data.Err != nil {
		tl.l.Error("trace error: BatchClose", "err", data.Err, "interval", interval)
		return
	}

	if interval > slowQueryThreshold {
		tl.l.Warn("slow batch", "sql", queryData.sql, "interval_secs", float64(interval)/float64(time.Second))
	}
}

type traceCopyFromData struct {
	startTime   time.Time
	TableName   pgx.Identifier
	ColumnNames []string
}

func (tl *Tracer) TraceCopyFromStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceCopyFromStartData) context.Context {
	return context.WithValue(ctx, traceCopyFromCtxKey, &traceCopyFromData{
		startTime:   time.Now(),
		TableName:   data.TableName,
		ColumnNames: data.ColumnNames,
	})
}

func (tl *Tracer) TraceCopyFromEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceCopyFromEndData) {
	copyFromData := ctx.Value(traceCopyFromCtxKey).(*traceCopyFromData)

	endTime := time.Now()
	interval := endTime.Sub(copyFromData.startTime)

	if data.Err != nil {
		tl.l.Error("trace error: CopyFrom", "err", data.Err, "tableName", copyFromData.TableName, "columnNames", copyFromData.ColumnNames, "interval", interval)
		return
	}
}

type traceConnectData struct {
	startTime  time.Time
	connConfig *pgx.ConnConfig
}

func (tl *Tracer) TraceConnectStart(ctx context.Context, data pgx.TraceConnectStartData) context.Context {
	return context.WithValue(ctx, traceConnectCtxKey, &traceConnectData{
		startTime:  time.Now(),
		connConfig: data.ConnConfig,
	})
}

func (tl *Tracer) TraceConnectEnd(ctx context.Context, data pgx.TraceConnectEndData) {
	connectData := ctx.Value(traceConnectCtxKey).(*traceConnectData)

	endTime := time.Now()
	interval := endTime.Sub(connectData.startTime)

	if data.Err != nil {
		tl.l.Error("trace error: Connect", "err", data.Err, "host", connectData.connConfig.Host, "port", connectData.connConfig.Port, "database", connectData.connConfig.Database, "interval", interval)
		return
	}
}

func (tl *Tracer) TracePrepareStart(ctx context.Context, _ *pgx.Conn, _ pgx.TracePrepareStartData) context.Context {
	return ctx
}

func (tl *Tracer) TracePrepareEnd(_ context.Context, _ *pgx.Conn, _ pgx.TracePrepareEndData) {
}
