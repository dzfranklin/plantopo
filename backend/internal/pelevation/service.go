package pelevation

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"log/slog"
)

type Service struct {
	c   *phttp.JSONClient
	cfg *pconfig.Elevation
	l   *slog.Logger
}

func New(env *pconfig.Env) *Service {
	return &Service{
		c:   phttp.NewJSONClient(env.Config.Elevation.Endpoint, env.Config.UserAgent),
		cfg: &env.Config.Elevation,
		l:   env.Logger,
	}
}

func (s *Service) Lookup(ctx context.Context, coordinates [][2]float64) ([]int32, error) {
	req := struct {
		Coordinates [][2]float64 `json:"coordinates"`
	}{coordinates}
	var resp struct {
		Elevations []int32 `json:"elevation"`
	}
	err := s.c.Post(ctx, &resp, "", &req)
	return resp.Elevations, err
}
