package session

import "time"

type Intervaler interface {
	Ticker() Tickable
}

type Tickable interface {
	Chan() <-chan time.Time
	Stop()
}

func Interval(d time.Duration) Intervaler {
	return &interval{d}
}

type interval struct {
	d time.Duration
}

func (i *interval) Ticker() Tickable {
	return &ticker{time.NewTicker(i.d)}
}

type ticker struct {
	*time.Ticker
}

func (t *ticker) Chan() <-chan time.Time {
	return t.C
}

func (t *ticker) Stop() {
	t.Ticker.Stop()
}
