package ptime

import (
	"context"
	"time"
)

func Sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	select {
	case <-ctx.Done():
		t.Stop()
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

func SleepUntil(ctx context.Context, t time.Time) error {
	now := time.Now()
	if !t.After(now) {
		return nil
	}
	diff := t.Sub(now)
	return Sleep(ctx, diff)
}
