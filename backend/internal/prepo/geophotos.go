package prepo

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tidwall/geojson/geometry"
	"iter"
	"time"
)

type Geophotos struct {
	db *pgxpool.Pool
}

func newGeophotos(db *pgxpool.Pool) *Geophotos {
	return &Geophotos{db: db}
}

type Geophoto struct {
	ID              int
	Source          int
	SourceID        string
	IndexRegionID   int
	IndexedAt       time.Time
	AttributionText string
	AttributionLink string
	Licenses        []int
	URL             string
	Width           int
	Height          int
	SmallURL        string
	SmallWidth      int
	SmallHeight     int
	Lng             float64
	Lat             float64
	Title           string
	DateTaken       time.Time
	DateUploaded    time.Time
}

func (r *Geophotos) ImportIfNotPresent(photo Geophoto) error {
	if photo.ID != 0 {
		return errors.New("cannot specify ID for create")
	}

	ctx, cancel := defaultContext()
	defer cancel()
	return q.ImportGeophotoIfNotPresent(ctx, r.db, psqlc.ImportGeophotoIfNotPresentParams{
		Source:          pgOptInt4(photo.Source),
		SourceID:        pgOptText(photo.SourceID),
		IndexRegionID:   pgOptInt4(photo.IndexRegionID),
		IndexedAt:       pgOptTimestamptz(photo.IndexedAt),
		AttributionText: pgOptText(photo.AttributionText),
		AttributionLink: pgOptText(photo.AttributionLink),
		Licenses:        pslices.Map(photo.Licenses, func(t int) int32 { return int32(t) }),
		Url:             photo.URL,
		Width:           int32(photo.Width),
		Height:          int32(photo.Height),
		SmallUrl:        pgOptText(photo.SmallURL),
		SmallWidth:      pgOptInt4(photo.SmallWidth),
		SmallHeight:     pgOptInt4(photo.SmallHeight),
		Lng:             photo.Lng,
		Lat:             photo.Lat,
		Title:           pgOptText(photo.Title),
		DateUploaded:    pgOptTimestamptz(photo.DateUploaded),
		DateTaken:       pgOptTimestamptz(photo.DateTaken),
	})
}

type FlickrIndexRegion struct {
	ID   int
	Name string
	Rect geometry.Rect
}

func (r *Geophotos) CreateFlickrIndexRegion(region *FlickrIndexRegion) error {
	ctx, cancel := defaultContext()
	defer cancel()
	if region.ID != 0 {
		return errors.New("unexpected ID present")
	}
	row, err := q.CreateFlickrIndexRegion(ctx, r.db, psqlc.CreateFlickrIndexRegionParams{
		Name:   region.Name,
		MinLng: region.Rect.Min.X,
		MinLat: region.Rect.Min.Y,
		MaxLng: region.Rect.Min.X,
		MaxLat: region.Rect.Min.Y,
	})
	if err != nil {
		return err
	}
	region.ID = int(row.ID)
	return nil
}

func (r *Geophotos) FlickrIndexRegions() ([]FlickrIndexRegion, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	rows, err := q.ListFlickrIndexRegions(ctx, r.db)
	if err != nil {
		return nil, err
	}
	return pslices.Map(rows, func(row psqlc.FlickrIndexRegion) FlickrIndexRegion {
		return FlickrIndexRegion{
			ID:   int(row.ID),
			Name: row.Name,
			Rect: geometry.Rect{
				Min: geometry.Point{
					X: row.MinLng,
					Y: row.MinLat,
				},
				Max: geometry.Point{
					X: row.MaxLng,
					Y: row.MaxLat,
				},
			},
		}
	}), nil
}

func (r *Geophotos) UpdateFlickrIndexProgress(region int, latest time.Time) error {
	ctx, cancel := defaultContext()
	defer cancel()
	return q.UpdateFlickrIndexProgress(ctx, r.db, int32(region), pgTimestamptz(latest))
}

func (r *Geophotos) GetFlickrIndexProgress(region int) (time.Time, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	row, err := q.GetFlickrIndexProgress(ctx, r.db, int32(region))
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, nil
	} else if err != nil {
		return time.Time{}, err
	}
	return row.Time, nil
}

func (r *Geophotos) UpdateGeographIndexProgress(cutoff int) error {
	ctx, cancel := defaultContext()
	defer cancel()
	return q.UpdateGeographIndexProgress(ctx, r.db, pgOptInt4(cutoff))
}

func (r *Geophotos) GetGeographIndexProgress() (int, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	row, err := q.GetGeographIndexProgress(ctx, r.db)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	return int(row.Int32), err
}

func (r *Geophotos) GetMany(ctx context.Context, ids []int) ([]Geophoto, error) {
	if len(ids) > 1000 {
		return nil, errors.New("too many ids")
	}

	rows, err := q.SelectGeophotosByID(ctx, r.db, pslices.Map(ids, func(n int) int64 { return int64(n) }))
	if err != nil {
		return nil, err
	}

	return pslices.Map(rows, mapGeophoto), nil
}

func (r *Geophotos) GetWithin(ctx context.Context, bbox geometry.Rect) ([]Geophoto, error) {
	rows, err := q.SelectGeophotosWithin(ctx, r.db, psqlc.SelectGeophotosWithinParams{
		Minlng:  bbox.Min.X,
		Minlat:  bbox.Min.Y,
		Maxlng:  bbox.Max.X,
		Maxlat:  bbox.Max.Y,
		MaxRows: 20,
	})
	if err != nil {
		return nil, err
	}

	return pslices.Map(rows, func(row psqlc.SelectGeophotosWithinRow) Geophoto {
		return mapGeophoto(psqlc.SelectGeophotosByIDRow(row))
	}), nil
}

type GeophotoPoint struct {
	ID    int
	Point geometry.Point
}

func (r *Geophotos) All(ctx context.Context) iter.Seq2[GeophotoPoint, error] {
	return func(yield func(GeophotoPoint, error) bool) {
		var cursor int64

		for {
			rows, err := q.SelectAllGeophotos(ctx, r.db, cursor)
			if err != nil {
				if !yield(GeophotoPoint{}, err) {
					return
				}
			}

			for _, row := range rows {
				v := GeophotoPoint{
					ID:    int(row.ID),
					Point: geometry.Point{X: row.Lng.Float64, Y: row.Lat.Float64},
				}
				if !yield(v, nil) {
					return
				}
			}

			if len(rows) == 0 {
				break
			}

			cursor = rows[len(rows)-1].ID
		}
	}
}

func mapGeophoto(row psqlc.SelectGeophotosByIDRow) Geophoto {
	return Geophoto{
		ID:              int(row.ID),
		Source:          int(row.Source.Int32),
		SourceID:        row.SourceID.String,
		IndexRegionID:   int(row.IndexRegionID.Int32),
		IndexedAt:       row.IndexedAt.Time,
		AttributionText: row.AttributionText.String,
		AttributionLink: row.AttributionLink.String,
		Licenses:        pslices.Map(row.Licenses, func(n int32) int { return int(n) }),
		URL:             row.Url,
		Width:           int(row.Width),
		Height:          int(row.Height),
		SmallURL:        row.SmallUrl.String,
		SmallHeight:     int(row.SmallHeight.Int32),
		SmallWidth:      int(row.SmallWidth.Int32),
		Lng:             row.Lng.Float64,
		Lat:             row.Lat.Float64,
		Title:           row.Title.String,
		DateUploaded:    row.DateUploaded.Time,
		DateTaken:       row.DateTaken.Time,
	}
}
