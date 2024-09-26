package papi

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pgeo"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
	"github.com/twpayne/go-polyline"
	"net/http"
	"time"
)

func (h *phandler) TracksGet(ctx context.Context, params TracksGetParams) (*TracksGetOK, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, ErrNotLoggedIn
	}

	if params.PerPage.Value > 1000 {
		return nil, badRequest("perPage cannot exceed 1000")
	}

	tracks, searchErr := h.Tracks.Search(prepo.TrackSearchOpts{
		Owner:                   user,
		Page:                    params.Page.Value,
		PerPage:                 params.PerPage.Value,
		OrderByName:             params.OrderBy.Value == TracksGetOrderByName,
		OrderByDateAsc:          params.OrderBy.Value == TracksGetOrderByDateAsc,
		OrderByDateDesc:         params.OrderBy.Value == TracksGetOrderByDateDesc,
		OrderByDateUploadedAsc:  params.OrderBy.Value == TracksGetOrderByDateUploadedAsc,
		OrderByDateUploadedDesc: params.OrderBy.Value == TracksGetOrderByDateUploadedDesc,
	})
	if searchErr != nil {
		return nil, searchErr
	}

	return &TracksGetOK{
		Page:    tracks.Page,
		PerPage: tracks.PerPage,
		Pages:   tracks.Pages,
		Total:   tracks.Total,
		Tracks:  pslices.Map(tracks.Tracks, mapTrackSummary),
	}, nil
}

func (h *phandler) TracksPost(ctx context.Context, req *TracksPostReq) (*TracksPostOK, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, ErrNotLoggedIn
	}

	tracks := make([]Track, 0, len(req.Tracks))
	for _, trackCreate := range req.Tracks {
		line, lineErr := unmarshalPolyline(trackCreate.Line)
		if lineErr != nil {
			return nil, lineErr
		}

		if trackCreate.Times != nil && line.NumPoints() != len(trackCreate.Times) {
			return nil, statusResponse(http.StatusBadRequest, "times does not match points")
		}

		track, insertErr := h.Tracks.Insert(prepo.Track{
			OwnerID:       user,
			Name:          trackCreate.Name.Value,
			DescriptionMd: trackCreate.DescriptionMd.Value,
			Date:          trackCreate.Date,
			Times:         trackCreate.Times,
			Line:          line,
		})
		if insertErr != nil {
			return nil, insertErr
		}
		tracks = append(tracks, mapTrack(track))
	}

	return &TracksPostOK{Tracks: tracks}, nil
}

func (h *phandler) TracksTileZXYMvtGet(ctx context.Context, params TracksTileZXYMvtGetParams) (*MVTTileHeaders, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, ErrNotLoggedIn
	}

	value, searchErr := h.Tracks.SearchTile(prepo.TrackSearchOpts{
		Owner: user,
	}, prepo.ZXY{Z: params.Z, X: params.X, Y: params.Y})
	if searchErr != nil {
		return nil, searchErr
	}

	return mvtResponse(ctx, value)
}

func (h *phandler) TracksTrackIDDelete(ctx context.Context, params TracksTrackIDDeleteParams) error {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return ErrNotLoggedIn
	}

	track, err := h.Tracks.Get(params.ID)
	if err != nil {
		return err
	}

	if user != track.OwnerID {
		return forbidden("you may not delete this track")
	}

	return h.Tracks.Delete(track.ID)
}

func (h *phandler) TracksTrackIDGet(ctx context.Context, params TracksTrackIDGetParams) (*TracksTrackIDGetOK, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, ErrNotLoggedIn
	}

	track, err := h.Tracks.Get(params.ID)
	if err != nil {
		return nil, err
	}

	if user != track.OwnerID {
		return nil, forbidden("you may not view this track")
	}

	return &TracksTrackIDGetOK{Track: mapTrack(track)}, nil
}

func (h *phandler) TracksTrackIDPatch(ctx context.Context, req *TracksTrackIDPatchReq, params TracksTrackIDPatchParams) (*TracksTrackIDPatchOK, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, ErrNotLoggedIn
	}

	prev, getErr := h.Tracks.Get(params.ID)
	if getErr != nil {
		return nil, getErr
	}

	if user != prev.OwnerID {
		return nil, forbidden("you may not update this track")
	}

	if req.Track.Name.Set {
		prev.Name = req.Track.Name.Value
	}
	if req.Track.DescriptionMd.Set {
		prev.DescriptionMd = req.Track.DescriptionMd.Value
	}
	if req.Track.Date.Set {
		prev.Date = req.Track.Date.Value
	}
	if req.Track.Line.Set {
		line, lineErr := unmarshalPolyline(req.Track.Line.Value)
		if lineErr != nil {
			return nil, lineErr
		}
		prev.Line = line
	}

	track, updateErr := h.Tracks.Update(prev)
	if updateErr != nil {
		return nil, updateErr
	}

	return &TracksTrackIDPatchOK{Track: mapTrack(track)}, nil
}

func mapTrack(track prepo.Track) Track {
	return Track{
		ID:            track.ID,
		OwnerID:       track.OwnerID,
		Name:          omitEmptyString(track.Name),
		DescriptionMd: omitEmptyString(track.DescriptionMd),
		Date:          track.Date,
		DateUploaded:  track.DateUploaded,
		LengthMeters:  track.LengthMeters,
		DurationSecs:  omitEmptyInt(int(track.Duration / time.Second)),
		Times:         track.Times,
		Line:          marshalPolyline(track.Line),
	}
}

func mapTrackSummary(track prepo.Track) TrackSummary {
	return TrackSummary{
		ID:             track.ID,
		OwnerID:        track.OwnerID,
		Name:           omitEmptyString(track.Name),
		DescriptionMd:  omitEmptyString(track.DescriptionMd),
		Date:           track.Date,
		DateUploaded:   track.DateUploaded,
		LengthMeters:   track.LengthMeters,
		DurationSecs:   omitEmptyInt(int(track.Duration / time.Second)),
		SimplifiedLine: marshalPolyline(pgeo.Simplify(track.Line, 0.00001, true)),
	}
}

func unmarshalPolyline(v Polyline) (*geometry.Line, error) {
	coords, remaining, err := polyline.DecodeCoords([]byte(v))
	if err != nil || len(remaining) > 0 {
		return nil, badRequest("invalid polyline")
	}
	points := make([]geometry.Point, len(coords))
	for i := range points {
		c := coords[i]
		points[i] = geometry.Point{Y: c[0], X: c[1]}
	}
	return geometry.NewLine(points, nil), nil
}

func marshalPolyline(line *geometry.Line) Polyline {
	points := pgeo.LinePoints(line)
	coords := make([][]float64, len(points))
	for i := range points {
		p := points[i]
		coords[i] = []float64{p.Y, p.X}
	}
	return Polyline(polyline.EncodeCoords(coords))
}
