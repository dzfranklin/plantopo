package pgeograph

import (
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"io"
	"log/slog"
)

type ImportRepo interface {
	ImportIfNotPresent(photo prepo.Geophoto) error
	UpdateGeographIndexProgress(cutoff int) error
	GetGeographIndexProgress() (int, error)
}

func importFiles(l *slog.Logger, repo ImportRepo, baseFile io.Reader, sizeFile io.Reader) error {
	cutoff, getCutoffErr := repo.GetGeographIndexProgress()
	if getCutoffErr != nil {
		return getCutoffErr
	}

	newCutoff, dump, parseErr := parseDump(l, cutoff, baseFile, sizeFile)
	if parseErr != nil {
		return parseErr
	}

	for _, entry := range dump {
		photo := mapToGeophoto(*entry)
		if insertErr := repo.ImportIfNotPresent(photo); insertErr != nil {
			return insertErr
		}
	}

	if updateErr := repo.UpdateGeographIndexProgress(newCutoff); updateErr != nil {
		return updateErr
	}

	return nil
}

func mapToGeophoto(entry gridimage) prepo.Geophoto {
	return prepo.Geophoto{}
}
