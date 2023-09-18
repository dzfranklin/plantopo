package map_sync

import (
	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/map_sync/repo"
	"go.uber.org/zap"
)

func NewRepo(l *zap.Logger, pg *db.Pg) repo.Repo {
	return repo.New(l, pg)
}
