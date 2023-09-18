package map_sync

import (
	"sync"
	"time"

	"github.com/danielzfranklin/plantopo/api/map_sync/repo"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Config struct {
	// the host this server can be externally reached at
	Host string
	// uniquely identifies this instance. must change on restart
	RunId      uuid.UUID // random if uuid.Nil
	Rdb        *redis.Client
	Wg         *sync.WaitGroup // optional
	Repo       repo.Repo
	Matchmaker struct {
		LockExpiry time.Duration // default if 0
	}
	Session struct {
		EmptyTimeout      time.Duration // default if 0
		SaveInterval      time.Duration // default if 0
		BroadcastInterval time.Duration // default if 0
		LogTraffic        bool
	}
}
