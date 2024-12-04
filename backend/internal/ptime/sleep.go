package ptime

import (
	"context"
	"math/rand"
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

func SleepJitter(ctx context.Context, d time.Duration, j time.Duration) error {
	total := d + time.Duration(rand.Int63n(int64(j)))
	return Sleep(ctx, total)
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

func Min(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func Max(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}
