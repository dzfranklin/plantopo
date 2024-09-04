package prepo

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tidwall/geojson/geometry"
	"time"
)

type Geophotos struct {
	db *pgxpool.Pool
}

func newGeophotos(db *pgxpool.Pool) *Geophotos {
	return &Geophotos{db: db}
}

type GeophotoInsertParams struct {
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
}

func (r *Geophotos) Insert(params GeophotoInsertParams) error {
	ctx, cancel := defaultContext()
	defer cancel()
	return q.InsertGeophoto(ctx, r.db, psqlc.InsertGeophotoParams{
		Source:          pgOptInt4(params.Source),
		SourceID:        pgOptText(params.SourceID),
		IndexRegionID:   pgOptInt4(params.IndexRegionID),
		IndexedAt:       pgOptTimestamptz(params.IndexedAt),
		AttributionText: pgOptText(params.AttributionText),
		AttributionLink: pgOptText(params.AttributionLink),
		Licenses:        pslices.Map(params.Licenses, func(t int) int32 { return int32(t) }),
		Url:             params.URL,
		Width:           int32(params.Width),
		Height:          int32(params.Height),
		SmallUrl:        pgOptText(params.SmallURL),
		SmallWidth:      pgOptInt4(params.SmallWidth),
		SmallHeight:     pgOptInt4(params.SmallHeight),
		Lng:             params.Lng,
		Lat:             params.Lat,
		Title:           pgOptText(params.Title),
		DateTaken:       pgOptTimestamptz(params.DateTaken),
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

func (r *Geophotos) UpdateGeographIndexProgress(latest time.Time) error {
	ctx, cancel := defaultContext()
	defer cancel()
	return q.UpdateGeographIndexProgress(ctx, r.db, pgTimestamptz(latest))
}
