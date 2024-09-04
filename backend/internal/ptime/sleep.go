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

func DayStart(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func DayEnd(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 24, 60, 60, 0, time.UTC)
}
