package pgeograph

import (
	"bytes"
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"io"
	"log/slog"
	"strconv"
	"time"
)

type ImportRepo interface {
	ImportIfNotPresent(photo prepo.Geophoto) error
	UpdateGeographIndexProgress(cutoff int) error
	GetGeographIndexProgress() (int, error)
}

func importLatest(env *pconfig.Env) error {
	l := env.Logger
	repo := prepo.New(env).Geophotos
	imageSecret := []byte(env.Config.Geograph.ImageSecret)

	time.Sleep(time.Minute)

	l.Info("downloading geograph dump")

	baseFile, err := downloadDump("gridimage_base.mysql.gz")
	if err != nil {
		return err
	}

	sizeFile, err := downloadDump("gridimage_size.mysql.gz")
	if err != nil {
		return err
	}

	l.Info("importing geograph dump")
	return importFiles(l, imageSecret, repo, bytes.NewReader(baseFile), bytes.NewReader(sizeFile))
}

func downloadDump(filename string) ([]byte, error) {
	resp, err := phttp.Get(context.Background(), "http://data.geograph.org.uk/dumps/"+filename)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(resp.Body)
}

func importFiles(l *slog.Logger, imageSecret []byte, repo ImportRepo, baseFile io.Reader, sizeFile io.Reader) error {
	cutoff, getCutoffErr := repo.GetGeographIndexProgress()
	if getCutoffErr != nil {
		return getCutoffErr
	}

	newCutoff, dump, parseErr := parseDump(l, cutoff, baseFile, sizeFile)
	if parseErr != nil {
		return parseErr
	}

	for _, entry := range dump {
		photo := mapToGeophoto(imageSecret, *entry)
		if insertErr := repo.ImportIfNotPresent(photo); insertErr != nil {
			return insertErr
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
