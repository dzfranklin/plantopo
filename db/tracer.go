package db

import (
	"context"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
	"time"
)

type queryTracer struct {
	l *zap.Logger
}

func QueryTracer(l *zap.Logger) pgx.QueryTracer {
	if l == nil {
		return nil
	} else {
		return &queryTracer{l: l.Named("db.tracer")}
	}
}

type ctxKey struct{}

type traceData struct {
	sql       string
	startTime time.Time
}

func (q *queryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if q == nil {
		return ctx
	}

	d := traceData{
		startTime: time.Now(),
		sql:       data.SQL,
	}
	return context.WithValue(ctx, ctxKey{}, d)
}

func (q *queryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	if q == nil {
		return
	}

	endTime := time.Now()

	d, ok := ctx.Value(ctxKey{}).(traceData)
	if !ok {
		q.l.Warn("failed to get query trace data from context")
		return
	}

	elapsed := endTime.Sub(d.startTime)

	if data.Err != nil {
		q.l.Warn("query failed: "+d.sql, zap.Duration("queryTime", elapsed), zap.Error(data.Err))
	} else {
		q.l.Info("query: "+d.sql, zap.Duration("queryTime", elapsed))
	}
}
