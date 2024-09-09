package pgeograph

import (
	"context"
	"fmt"
	"github.com/cenkalti/backoff/v4"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"io"
	"log/slog"
	"math"
	"os"
	"path"
	"strconv"
	"time"
)

type ImportRepo interface {
	ImportIfNotPresent(photo prepo.Geophoto) error
	UpdateGeographIndexProgress(cutoff int) error
	GetGeographIndexProgress() (int, error)
}

func importLatest(ctx context.Context, env *pconfig.Env) error {
	l := env.Logger
	repo := prepo.New(env).Geophotos
	imageSecret := []byte(env.Config.Geograph.ImageSecret)

	dir, err := os.MkdirTemp("", "")
	if err != nil {
		return err
	}
	defer func() { _ = os.RemoveAll(dir) }()

	l.Info("downloading geograph dump")

	baseFile, err := downloadDump(ctx, dir, "gridimage_base.tsv.gz")
	if err != nil {
		return err
	}
	defer baseFile.Close()

	sizeFile, err := downloadDump(ctx, dir, "gridimage_size.tsv.gz")
	if err != nil {
		return err
	}
	defer sizeFile.Close()

	l.Info("importing geograph dump")
	importErr := importFiles(ctx, l, imageSecret, repo, baseFile, sizeFile)
	if importErr != nil {
		return importErr
	}
	l.Info("imported geograph dump")
	return nil
}

func downloadDump(ctx context.Context, dir, filename string) (io.ReadCloser, error) {
	resp, getErr := phttp.Get(ctx, "http://data.geograph.org.uk/dumps/"+filename)
	if getErr != nil {
		return nil, getErr
	}
	defer resp.Body.Close()

	f, createErr := os.Create(path.Join(dir, filename))
	if createErr != nil {
		return nil, createErr
	}

	_, copyErr := io.Copy(f, resp.Body)
	if copyErr != nil {
		return nil, copyErr
	}

	_, seekErr := f.Seek(0, io.SeekStart)
	if seekErr != nil {
		return nil, seekErr
	}

	return f, nil
}

func importFiles(
	ctx context.Context,
	l *slog.Logger,
	imageSecret []byte,
	repo ImportRepo,
	baseFile io.Reader,
	sizeFile io.Reader,
) error {
	cutoff, getCutoffErr := repo.GetGeographIndexProgress()
	if getCutoffErr != nil {
		return getCutoffErr
	}

	l.Info("parsing dump")
	newCutoff, dump, parseErr := parseDump(cutoff, baseFile, sizeFile)
	if parseErr != nil {
		return parseErr
	}

	l.Info("loading dump")
	total := float64(len(dump))
	inserted := 0
	for _, entry := range dump {
		if err := ctx.Err(); err != nil {
			return err
		}

		photo := mapToGeophoto(imageSecret, *entry)

		insertErr := backoff.Retry(func() error {
			return repo.ImportIfNotPresent(photo)
		}, backoff.WithContext(backoff.NewExponentialBackOff(), ctx))
		if insertErr != nil {
			return insertErr
		}

		inserted++
		percentDone := (float64(inserted) / total) * 100

		if inserted%10_000 == 0 {
			if updateErr := repo.UpdateGeographIndexProgress(newCutoff); updateErr != nil {
				return updateErr
			}

			l.Info("geograph import progress", "inserted", inserted, "percentDone", math.Floor(percentDone))
		}
	}

	if updateErr := repo.UpdateGeographIndexProgress(newCutoff); updateErr != nil {
		return updateErr
	}

	return nil
}

func mapToGeophoto(secret []byte, entry gridimage) prepo.Geophoto {
	original := originalImage(secret, entry)
	small := smallImage(secret, entry)
	return prepo.Geophoto{
		IndexedAt:       time.Now(),
		Source:          2,
		SourceID:        strconv.FormatInt(int64(entry.GridimageID), 10),
		AttributionText: fmt.Sprintf("%s (geograph.org.uk)", entry.Realname),
		AttributionLink: fmt.Sprintf("https://www.geograph.org.uk/photo/%d", entry.GridimageID),
		Licenses:        []int{11},
		URL:             original.Src,
		Width:           original.Width,
		Height:          original.Height,
		SmallURL:        small.Src,
		SmallWidth:      small.Width,
		SmallHeight:     small.Height,
		Lng:             entry.WGS84Long,
		Lat:             entry.WGS84Lat,
		Title:           entry.Title,
		DateTaken:       entry.ImageTaken,
	}
}
