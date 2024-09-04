package prepo

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

const britishAndIrishHillPhotoIDKind = "bihp"

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
	ID                  string
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
		ids = append(ids, row.ID)
		out = append(out, mapBritishIrishHill(row))
	}

	hillPhotos, err := q.ListBritishAndIrishHillPhotosOf(ctx, s.db, ids)
	if err != nil {
		return nil, err
	}
	for _, photo := range hillPhotos {
		for i := range out {
			if out[i].ID == photo.HillID {
				out[i].Photos = append(out[i].Photos, mapBritishIrishHillPhoto(photo))
			}
		}
	}

	return out, nil
}

func (s *BritishAndIrishHills) Get(id int32) (BritishOrIrishHill, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	row, err := q.SelectBritishAndIrishHill(ctx, s.db, id)
	if err != nil {
		return BritishOrIrishHill{}, nil
	}
	return mapBritishIrishHill(psqlc.ListBritishAndIrishHillsRow(row)), nil
}

func (s *BritishAndIrishHills) ApproveHillPhoto(id string) error {
	ctx, cancel := defaultContext()
	defer cancel()
	dbID, err := IDToSerial(britishAndIrishHillPhotoIDKind, id)
	if err != nil {
		return err
	}
	return q.ApproveBritishAndIrishHillPhoto(ctx, s.db, dbID)
}

func (s *BritishAndIrishHills) GetUnreviewedPhoto() (*HillPhoto, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	row, err := q.SelectOneUnreviewedBritishAndIrishHillPhoto(ctx, s.db)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	p := mapBritishIrishHillPhoto(row)
	return &p, nil
}

func mapBritishIrishHill(row psqlc.ListBritishAndIrishHillsRow) BritishOrIrishHill {
	var smcParentID *int32
	if row.SmcParentID.Valid {
		smcParentID = &row.SmcParentID.Int32
	}
	return BritishOrIrishHill{
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
	}
}

func mapBritishIrishHillPhoto(d psqlc.BritishAndIrishHillPhoto) HillPhoto {
	return HillPhoto{
		ID:         SerialToID(britishAndIrishHillPhotoIDKind, d.ID),
		HillID:     d.HillID,
		Caption:    d.Caption.String,
		Licenses:   d.Licenses,
		Source:     d.Source,
		Size:       int(d.Size),
		Width:      int(d.Width),
		Height:     int(d.Height),
		UploadedAt: d.UploadedAt.Time,
		Author:     d.Author.String,
		SourceText: d.SourceText.String,
		SourceLink: d.SourceLink.String,
		Importer:   d.Importer.String,
	}
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
		UploadedAt: pgOptTimestamp(opts.UploadedAt.UTC()),
		Author:     pgOptText(opts.Author),
		SourceText: pgOptText(opts.SourceText),
		SourceLink: pgOptText(opts.SourceLink),
		Importer:   pgOptText(opts.Importer),
	})
}
