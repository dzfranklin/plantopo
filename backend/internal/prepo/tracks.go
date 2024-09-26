package prepo

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tidwall/geojson/geometry"
	"golang.org/x/sync/errgroup"
	"log/slog"
	"math"
	"time"
)

type Track struct {
	ID            string
	OwnerID       string
	Name          string
	DescriptionMd string
	Date          time.Time
	DateUploaded  time.Time
	LengthMeters  float64       // computed
	Duration      time.Duration // computed
	Times         []time.Time
	Line          *geometry.Line
}

type Tracks struct {
	db *pgxpool.Pool
	l  *slog.Logger
}

func NewTracks(env *pconfig.Env) *Tracks {
	return &Tracks{db: env.DB, l: env.Logger}
}

func (r *Tracks) Insert(track Track) (Track, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	if track.ID != "" {
		return Track{}, errors.New("cannot specify id of track to insert")
	}
	if !track.DateUploaded.IsZero() {
		return Track{}, errors.New("cannot specify date uploaded of track to insert")
	}

	ownerID, err := IDToUUID(userIDKind, track.OwnerID)
	if err != nil {
		return Track{}, err
	}

	row, err := q.InsertTrack(ctx, r.db, psqlc.InsertTrackParams{
		OwnerID:       pgUUID(ownerID),
		Name:          pgOptText(track.Name),
		DescriptionMd: pgOptText(track.DescriptionMd),
		Date:          pgOptTimestamptz(track.Date),
		Times:         mapTimesToDB(track.Times),
		Line:          psqlc.Geometry{Geometry: track.Line},
	})
	if err != nil {
		return Track{}, err
	}
	return mapTrack(row), nil
}

func (r *Tracks) Update(track Track) (Track, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	if track.ID == "" {
		return Track{}, errors.New("must specify id of track to update")
	}
	dbID, idErr := IDToUUID(trackIDKind, track.ID)
	if idErr != nil {
		return Track{}, idErr
	}

	row, err := q.UpdateTrack(ctx, r.db, psqlc.UpdateTrackParams{
		ID:            pgUUID(dbID),
		Name:          pgOptText(track.Name),
		DescriptionMd: pgOptText(track.DescriptionMd),
		Date:          pgTimestamptz(track.Date),
		Times:         mapTimesToDB(track.Times),
		Line:          psqlc.Geometry{Geometry: track.Line},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Track{}, ErrNotFound
	} else if err != nil {
		return Track{}, err
	}
	return mapTrack(row), nil
}

func (r *Tracks) Get(id string) (Track, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbID, idErr := IDToUUID(trackIDKind, id)
	if idErr != nil {
		return Track{}, idErr
	}

	row, err := q.SelectTrack(ctx, r.db, pgUUID(dbID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Track{}, ErrNotFound
	} else if err != nil {
		return Track{}, err
	}
	return mapTrack(row), nil
}

func (r *Tracks) Delete(id string) error {
	ctx, cancel := defaultContext()
	defer cancel()

	dbID, idErr := IDToUUID(trackIDKind, id)
	if idErr != nil {
		return idErr
	}

	return q.DeleteTrack(ctx, r.db, pgUUID(dbID))
}

type TrackSearchOpts struct {
	Owner   string
	Page    int
	PerPage int

	OrderByName             bool
	OrderByDateAsc          bool
	OrderByDateDesc         bool
	OrderByDateUploadedAsc  bool
	OrderByDateUploadedDesc bool
}

type TrackSearchPage struct {
	Tracks  []Track
	Page    int
	PerPage int
	Pages   int
	Total   int
}

func (r *Tracks) Search(opts TrackSearchOpts) (TrackSearchPage, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	// Prepare

	if opts.Owner == "" {
		return TrackSearchPage{}, errors.New("must specify owner")
	}
	ownerID, ownerErr := IDToUUID(userIDKind, opts.Owner)
	if ownerErr != nil {
		return TrackSearchPage{}, ownerErr
	}

	orderBySet := trueCount(opts.OrderByName, opts.OrderByDateAsc, opts.OrderByDateDesc,
		opts.OrderByDateUploadedAsc, opts.OrderByDateUploadedDesc)
	if orderBySet == 0 {
		opts.OrderByDateDesc = true
	} else if orderBySet > 1 {
		return TrackSearchPage{}, errors.New("can only set one order by")
	}

	if opts.PerPage == 0 {
		opts.PerPage = 250
	}

	if opts.Page == 0 {
		opts.Page = 1
	}

	offset := (opts.Page - 1) * opts.PerPage
	limit := opts.PerPage

	// Fetch

	errGrp, ctx := errgroup.WithContext(ctx)

	var count int
	errGrp.Go(func() error {
		res, err := q.CountSearchTracks(ctx, r.db, pgUUID(ownerID))
		if err != nil {
			return err
		}
		count = int(res)
		return nil
	})

	var tracks []Track
	errGrp.Go(func() error {
		rows, err := q.SearchTracks(ctx, r.db, psqlc.SearchTracksParams{
			OwnerID:                 pgUUID(ownerID),
			OrderByName:             pgBool(opts.OrderByName),
			OrderByDateAsc:          pgBool(opts.OrderByDateAsc),
			OrderByDateDesc:         pgBool(opts.OrderByDateDesc),
			OrderByDateUploadedAsc:  pgBool(opts.OrderByDateUploadedAsc),
			OrderByDateUploadedDesc: pgBool(opts.OrderByDateUploadedDesc),
			OffsetValue:             int64(offset),
			LimitValue:              int64(limit),
		})
		if err != nil {
			return err
		}
		tracks = pslices.Map(rows, mapTrack)
		return nil
	})

	if err := errGrp.Wait(); err != nil {
		return TrackSearchPage{}, err
	}

	// Process

	if offset > count {
		// Ensure the result is consistent
		tracks = []Track{}
	}

	pages := int(math.Ceil(float64(count) / float64(opts.PerPage)))

	return TrackSearchPage{
		Tracks:  tracks,
		Page:    opts.Page,
		PerPage: opts.PerPage,
		Pages:   pages,
		Total:   count,
	}, nil
}

func (r *Tracks) SearchTile(opts TrackSearchOpts, zxy ZXY) ([]byte, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	if err := zxy.Validate(); err != nil {
		return nil, err
	}
	ownerID, ownerErr := IDToUUID(userIDKind, opts.Owner)
	if ownerErr != nil {
		return nil, ownerErr
	}

	return q.SearchTracksTile(ctx, r.db, psqlc.SearchTracksTileParams{
		Z:       int32(zxy.Z),
		X:       int32(zxy.X),
		Y:       int32(zxy.Y),
		OwnerID: pgUUID(ownerID),
	})
}

func mapTrack(row psqlc.Track) Track {
	return Track{
		ID:            UUIDToID(trackIDKind, row.ID.Bytes),
		OwnerID:       UUIDToID(userIDKind, row.OwnerID.Bytes),
		Name:          row.Name.String,
		DescriptionMd: row.DescriptionMd.String,
		Date:          row.Date.Time,
		DateUploaded:  row.DateUploaded.Time,
		LengthMeters:  row.LengthMeters.Float64,
		Duration:      time.Second * time.Duration(row.DurationSecs.Int32),
		Times:         pslices.Map(row.Times.Elements, func(t pgtype.Timestamptz) time.Time { return t.Time }),
		Line:          row.Line.Geometry.(*geometry.Line),
	}
}

func mapTimesToDB(times []time.Time) pgtype.Array[pgtype.Timestamptz] {
	if len(times) == 0 {
		return pgtype.Array[pgtype.Timestamptz]{}
	}
	return pgtype.Array[pgtype.Timestamptz]{
		Valid:    true,
		Elements: pslices.Map(times, func(t time.Time) pgtype.Timestamptz { return pgTimestamptz(t) }),
		Dims:     []pgtype.ArrayDimension{{LowerBound: 1, Length: int32(len(times))}},
	}
}
