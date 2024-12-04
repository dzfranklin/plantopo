package pconfig

import "time"

type DBStats struct {
	AcquireCount            int64
	AcquireDuration         time.Duration
	AcquiredConns           int32
	CanceledAcquireCount    int64
	ConstructingConns       int32
	EmptyAcquireCount       int64
	IdleConns               int32
	MaxConns                int32
	TotalConns              int32
	NewConnsCount           int64
	MaxLifetimeDestroyCount int64
	MaxIdleDestroyCount     int64
}

func (e *Env) DBStats() DBStats {
	s := e.DB.Stat()
	return DBStats{
		AcquireCount:            s.AcquireCount(),
		AcquireDuration:         s.AcquireDuration(),
		AcquiredConns:           s.AcquiredConns(),
		CanceledAcquireCount:    s.CanceledAcquireCount(),
		ConstructingConns:       s.ConstructingConns(),
		EmptyAcquireCount:       s.EmptyAcquireCount(),
		IdleConns:               s.IdleConns(),
		MaxConns:                s.MaxConns(),
		TotalConns:              s.TotalConns(),
		NewConnsCount:           s.NewConnsCount(),
		MaxLifetimeDestroyCount: s.MaxLifetimeDestroyCount(),
		MaxIdleDestroyCount:     s.MaxIdleDestroyCount(),
	}
}
