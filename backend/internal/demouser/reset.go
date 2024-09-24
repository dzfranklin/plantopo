package demouser

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
	"github.com/twpayne/go-polyline"
	"golang.org/x/sync/errgroup"
	"io"
	"time"
)

const ID = "u_drckha3aas1bq3bjqx5kmz3syc" // 6e1938a8-6a56-42bb-8d72-bf4b3a7c79f3
const Name = "Demo User"
const Email = "demo@plantopo.com"
const Password = "3f7ae267-d056-4a44-a3e9-9c10b1bdda1f"

func Reset(ctx context.Context, env *pconfig.Env) error {
	repo := prepo.New(env)

	user, getUserErr := repo.Users.Get(ID)
	if getUserErr != nil {
		return getUserErr
	}

	if user.Name != Name || user.Email != Email {
		return errors.New("expected preset name and email")
	}

	// Delete

	var deleteGrp errgroup.Group

	deleteGrp.Go(func() error { return repo.Users.ResetSettings(ID) })
	deleteGrp.Go(func() error { return deleteAllTracks(ctx, repo) })

	if err := deleteGrp.Wait(); err != nil {
		return err
	}

	// Create

	var createGrp errgroup.Group

	createGrp.Go(func() error { return createTracks(ctx, env.Config.DemoUser.SampleTracksURL, repo) })

	if err := createGrp.Wait(); err != nil {
		return err
	}

	return nil
}

func deleteAllTracks(ctx context.Context, repo *prepo.Repo) error {
	start := time.Now()
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		page, err := repo.Tracks.Search(prepo.TrackSearchOpts{
			Owner:                  ID,
			PerPage:                1000,
			OrderByDateUploadedAsc: true,
		})
		if err != nil {
			return err
		}

		if len(page.Tracks) == 0 {
			return nil
		}

		for _, track := range page.Tracks {
			if track.DateUploaded.After(start) {
				return nil
			}

			if err := repo.Tracks.Delete(track.ID); err != nil {
				return err
			}
		}
	}
}

func createTracks(ctx context.Context, source string, repo *prepo.Repo) error {
	createResp, getErr := phttp.Get(ctx, source)
	if getErr != nil {
		return getErr
	}
	defer createResp.Body.Close()

	var grp errgroup.Group
	grp.SetLimit(10)
	defer func() { _ = grp.Wait() }()

	dec := json.NewDecoder(createResp.Body)
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		var entry struct {
			Name  string      `json:"name"`
			Date  time.Time   `json:"date"`
			Line  string      `json:"line"`
			Times []time.Time `json:"times"`
		}
		decErr := dec.Decode(&entry)
		if decErr == io.EOF {
			break
		} else if decErr != nil {
			return decErr
		}

		grp.Go(func() error {
			coords, rest, decodeErr := polyline.DecodeCoords([]byte(entry.Line))
			if decodeErr != nil {
				return decodeErr
			}
			if len(rest) > 0 {
				return errors.New("decode polyline: unexpected rest")
			}
			line := geometry.NewLine(pslices.Map(coords, func(p []float64) geometry.Point {
				return geometry.Point{Y: p[0], X: p[1]}
			}), nil)

			track := prepo.Track{
				OwnerID: ID,
				Name:    entry.Name,
				Date:    entry.Date,
				Line:    line,
				Times:   entry.Times,
			}
			_, insertErr := repo.Tracks.Insert(track)
			return insertErr
		})
	}

	return grp.Wait()
}
