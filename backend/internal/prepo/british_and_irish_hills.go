package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type BritishAndIrishHills struct {
	db *pgxpool.Pool
}

func NewBritishAndIrishHills(db *pgxpool.Pool) *BritishAndIrishHills {
	return &BritishAndIrishHills{db: db}
}

type ListBritishAndIrishHillsOpts struct {
	Classification string
}

type BritishOrIrishHill struct {
	ID             int32
	Name           string
	Lng            float64
	Lat            float64
	SMCParentID    *int32
	Classification []string
	Map50k         string
	Map25k         string
	Metres         float64
	GridRef        string
	GridRef10      string
	Drop           float64
	ColGridRef     string
	ColHeight      float64
	Feature        string
	Observations   string
	Survey         string
	Country        string
	Revision       string
	Comments       string
	Photos         []HillPhoto
}

type HillPhoto struct {
	Caption             string
	Licenses            []string
	Source              string
	Size, Width, Height int
	UploadedAt          time.Time
	Author              string
	SourceText          string
	SourceLink          string
	Importer            string
}

func (s *BritishAndIrishHills) List(opts ListBritishAndIrishHillsOpts) ([]BritishOrIrishHill, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	classificationContainsSpecified := opts.Classification != ""
	var classificationContains []string
	if classificationContainsSpecified {
		classificationContains = []string{opts.Classification}
	}

	rows, err := q.ListBritishAndIrishHills(ctx, s.db, classificationContainsSpecified, classificationContains)
	if err != nil {
		return nil, err
	}

	var out []BritishOrIrishHill
	var ids []int32
	for _, row := range rows {
		var smcParentID *int32
		if row.SmcParentID.Valid {
			smcParentID = &row.SmcParentID.Int32
		}

		ids = append(ids, row.ID)
		out = append(out, BritishOrIrishHill{
			ID:             row.ID,
			Name:           row.Name.String,
			Lng:            row.Lng.Float64,
			Lat:            row.Lat.Float64,
			SMCParentID:    smcParentID,
			Classification: row.Classification,
			Map50k:         row.Map50k.String,
			Map25k:         row.Map25k.String,
			Metres:         row.Metres.Float64,
			GridRef:        row.GridRef.String,
			GridRef10:      row.GridRef10.String,
			Drop:           row.Drop.Float64,
			ColGridRef:     row.ColGridRef.String,
			ColHeight:      row.ColHeight.Float64,
			Feature:        row.Feature.String,
			Observations:   row.Observations.String,
			Survey:         row.Survey.String,
			Country:        row.Country.String,
			Revision:       row.Revision.String,
			Comments:       row.Comments.String,
		})
	}

	hillPhotos, err := q.ListBritishAndIrishHillPhotosOf(ctx, s.db, ids)
	if err != nil {
		return nil, err
	}
	for _, photo := range hillPhotos {
		for i := range out {
			if out[i].ID == photo.HillID {
				out[i].Photos = append(out[i].Photos, HillPhoto{
					Caption:    photo.Caption.String,
					Licenses:   photo.Licenses,
					Source:     photo.Source,
					Size:       int(photo.Size),
					Width:      int(photo.Width),
					Height:     int(photo.Height),
					UploadedAt: photo.UploadedAt.Time,
					Author:     photo.Author.String,
					SourceText: photo.SourceText.String,
					SourceLink: photo.SourceLink.String,
					Importer:   photo.Importer.String,
				})
			}
		}
	}

	return out, nil
}

type InsertBritishOrIrishHillPhotoOpts struct {
	HillID              int32
	Caption             string
	Licenses            []string
	Source              string
	Size, Width, Height int
	UploadedAt          time.Time
	Author              string
	SourceText          string
	SourceLink          string
	Importer            string
}

func (s *BritishAndIrishHills) InsertPhoto(opts InsertBritishOrIrishHillPhotoOpts) error {
	ctx, cancel := defaultContext()
	defer cancel()

	return q.InsertBritishAndIrishHillsPhoto(ctx, s.db, psqlc.InsertBritishAndIrishHillsPhotoParams{
		HillID:     opts.HillID,
		Caption:    pgOptText(opts.Caption),
		Licenses:   opts.Licenses,
		Source:     opts.Source,
		Size:       int32(opts.Size),
		Width:      int32(opts.Width),
		Height:     int32(opts.Height),
		UploadedAt: pgOptTime(opts.UploadedAt.UTC()),
		Author:     pgOptText(opts.Author),
		SourceText: pgOptText(opts.SourceText),
		SourceLink: pgOptText(opts.SourceLink),
		Importer:   pgOptText(opts.Importer),
	})
}
