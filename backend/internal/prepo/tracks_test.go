package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson"
	"github.com/tidwall/geojson/geometry"
	"strings"
	"testing"
	"time"
)

func TestTracks(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)

	userID := "u_248h248h248h248h248h248h24"
	otherUserID := "u_248h248h248h248h248h248h28"

	makeSubject := func(t *testing.T) *Tracks {
		t.Helper()
		return NewTracks(env.Env)
	}

	validNewTrack := Track{
		OwnerID: userID,
		Name:    "My Track",
		Date:    ptime.DayStart(2020, 1, 1),
		Times:   nil, // optional
		Line:    geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}}, nil),
	}

	mustInsert := func(t *testing.T, subject *Tracks, track Track) Track {
		t.Helper()

		if track.Date.IsZero() {
			track.Date = validNewTrack.Date
		}
		if track.Duration == 0 && track.Times == nil && track.Line == nil {
			track.Duration = validNewTrack.Duration
			track.Times = validNewTrack.Times
			track.Line = validNewTrack.Line
		}

		got, err := subject.Insert(track)
		require.NoError(t, err)
		return got
	}

	t.Run("Insert without times", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		got, err := subject.Insert(validNewTrack)
		require.NoError(t, err)

		assert.True(t, strings.HasPrefix(got.ID, "t_"))
		assert.Equal(t, userID, got.OwnerID)
		assert.Equal(t, "My Track", got.Name)
		assert.Equal(t, ptime.DayStart(2020, 1, 1), got.Date.UTC())
		assert.False(t, got.DateUploaded.IsZero())
		assert.InDelta(t, 156876, got.LengthMeters, 1) // Checked with ` echo "1N 1W 2N 2W" | geod +ellps=WGS84 -I`
		assert.Zero(t, got.Duration)
		require.Nil(t, got.Times)

		gotLineJSON, err := geojson.NewLineString(got.Line).MarshalJSON()
		assert.NoError(t, err)
		require.JSONEq(t,
			`{"type": "LineString", "coordinates": [[1,1], [2,2]]}`,
			string(gotLineJSON))
	})

	t.Run("duration 2 points", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		time1 := ptime.DayStart(2020, 1, 1)

		got1, err := subject.Insert(Track{
			OwnerID: userID,
			Name:    "My Track",
			Date:    ptime.DayStart(2020, 1, 1),
			Times:   []time.Time{time1, time1.Add(time.Hour)},
			Line:    geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}}, nil),
		})
		require.NoError(t, err)
		require.Equal(t, time.Hour, got1.Duration)
	})

	t.Run("duration 3 points", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		time1 := ptime.DayStart(2020, 1, 1)

		got1, err := subject.Insert(Track{
			OwnerID: userID,
			Name:    "My Track",
			Date:    ptime.DayStart(2020, 1, 1),
			Times:   []time.Time{time1, time1.Add(time.Hour), time1.Add(time.Hour * 2)},
			Line:    geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}, {X: 3, Y: 3}}, nil),
		})
		require.NoError(t, err)
		require.Equal(t, time.Hour*2, got1.Duration)
	})

	t.Run("Insert with invalid times", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		_, err := subject.Insert(Track{
			OwnerID: userID,
			Date:    ptime.DayStart(2020, 1, 1),
			Times:   []time.Time{ptime.DayStart(2020, 1, 1)},
			Line:    geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}}, nil),
		})
		require.ErrorContains(t, err, "violates check constraint \"tracks_check\"")
	})

	t.Run("Update nonexistent", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		_, err := subject.Update(Track{
			ID:      "t_068zcgas6sw61d3b4ake48drh0",
			OwnerID: userID,
			Name:    "new name",
			Line:    geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}}, nil),
		})
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("Updating owner is ignored", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		v1 := mustInsert(t, subject, Track{OwnerID: userID})

		update := v1
		update.OwnerID = otherUserID
		v2, err := subject.Update(update)
		require.NoError(t, err)

		require.Equal(t, userID, v2.OwnerID)
	})

	t.Run("Update", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		time1 := ptime.DayStart(2020, 1, 1)

		v1 := mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "My Track",
			Date:    ptime.DayStart(2020, 1, 1),
			Line:    geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}}, nil),
		})
		require.Empty(t, v1.Times)
		require.Zero(t, v1.Duration)
		assert.InDelta(t, 156876, v1.LengthMeters, 1) // Checked with `echo "1N 1W 2N 2W" | geod +ellps=WGS84 -I`

		update := v1
		update.Name = "New name"
		update.DescriptionMd = "New description"
		update.Date = ptime.DayStart(2020, 1, 2)
		update.Line = geometry.NewLine([]geometry.Point{{X: 1, Y: 1}, {X: 2, Y: 2}, {X: 3, Y: 3}}, nil)
		update.Times = []time.Time{time1, time1.Add(time.Minute), time1.Add(time.Hour)}
		v2, err := subject.Update(update)
		require.NoError(t, err)

		require.Equal(t, "New name", v2.Name)
		require.Equal(t, "New description", v2.DescriptionMd)
		require.Equal(t, ptime.DayStart(2020, 1, 2), v2.Date.UTC())
		require.Equal(t, 3, v2.Line.NumPoints())
		require.Len(t, v2.Times, 3)
		require.Equal(t, time.Hour, v2.Duration)
		require.InDelta(t, 156876+156829, v2.LengthMeters, 10)
	})

	t.Run("Get", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)
		t1 := mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "The first track",
			Date:    ptime.DayStart(2020, 1, 20),
		})

		_, err := subject.Get("t_068zcgas6sw61d3b4ake48drh0")
		require.ErrorIs(t, err, ErrNotFound)

		got, err := subject.Get(t1.ID)
		require.NoError(t, err)
		require.Equal(t, t1, got)
	})

	t.Run("Delete", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)
		t1 := mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "The first track",
			Date:    ptime.DayStart(2020, 1, 20),
		})

		_, err := subject.Get(t1.ID)
		require.NoError(t, err)

		require.NoError(t, subject.Delete(t1.ID))

		// Check it's idempotent
		require.NoError(t, subject.Delete(t1.ID))

		_, err = subject.Get(t1.ID)
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("Search", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		mustInsert(t, subject, Track{
			OwnerID: otherUserID,
			Name:    "should not be present",
			Date:    ptime.DayStart(2020, 1, 1),
		})

		t1 := mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "The first track",
			Date:    ptime.DayStart(2020, 1, 20),
		})
		t2 := mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "The second track",
			Date:    ptime.DayStart(2020, 1, 19),
		})

		nameOrder := []string{t1.ID, t2.ID}
		dateAscOrder := []string{t2.ID, t1.ID}
		dateDescOrder := []string{t1.ID, t2.ID}
		dateUploadedAscOrder := []string{t1.ID, t2.ID}
		dateUploadedDescOrder := []string{t2.ID, t1.ID}

		type testPage struct {
			Tracks  []string
			Page    int
			HasNext bool
		}

		cases := []struct {
			name        string
			opts        TrackSearchOpts
			expected    testPage
			expectedErr string
		}{
			{
				name:        "nothing specified",
				expectedErr: "must specify owner",
			},
			{
				name:     "no order by specified",
				opts:     TrackSearchOpts{Owner: userID},
				expected: testPage{Tracks: dateDescOrder, Page: 1, HasNext: false},
			},
			{
				name:        "multiple order by specified",
				opts:        TrackSearchOpts{Owner: userID, OrderByName: true, OrderByDateAsc: true},
				expectedErr: "can only set one order by",
			},
			{
				name:     "name order",
				opts:     TrackSearchOpts{Owner: userID, OrderByName: true},
				expected: testPage{Tracks: nameOrder, Page: 1, HasNext: false},
			},
			{
				name:     "date asc order",
				opts:     TrackSearchOpts{Owner: userID, OrderByDateAsc: true},
				expected: testPage{Tracks: dateAscOrder, Page: 1, HasNext: false},
			},
			{
				name:     "date desc order",
				opts:     TrackSearchOpts{Owner: userID, OrderByDateDesc: true},
				expected: testPage{Tracks: dateDescOrder, Page: 1, HasNext: false},
			},
			{
				name:     "date uploaded asc order",
				opts:     TrackSearchOpts{Owner: userID, OrderByDateUploadedAsc: true},
				expected: testPage{Tracks: dateUploadedAscOrder, Page: 1, HasNext: false},
			},
			{
				name:     "date uploaded desc order",
				opts:     TrackSearchOpts{Owner: userID, OrderByDateUploadedDesc: true},
				expected: testPage{Tracks: dateUploadedDescOrder, Page: 1, HasNext: false},
			},
			{
				name:     "implicit page 1",
				opts:     TrackSearchOpts{Owner: userID, PerPage: 1},
				expected: testPage{Tracks: dateDescOrder[:1], Page: 1, HasNext: true},
			},
			{
				name:     "explicit page 1",
				opts:     TrackSearchOpts{Owner: userID, PerPage: 1, Page: 1},
				expected: testPage{Tracks: dateDescOrder[:1], Page: 1, HasNext: true},
			},
			{
				name:     "page 2",
				opts:     TrackSearchOpts{Owner: userID, PerPage: 1, Page: 2},
				expected: testPage{Tracks: dateDescOrder[1:2], Page: 2, HasNext: false},
			},
		}
		for _, c := range cases {
			t.Run(c.name, func(t *testing.T) {
				got, gotErr := subject.Search(c.opts)
				if c.expectedErr != "" {
					require.ErrorContains(t, gotErr, c.expectedErr)
				} else {
					require.NoError(t, gotErr)
					gotPage := testPage{
						Tracks:  pslices.Map(got.Tracks, func(r Track) string { return r.ID }),
						Page:    got.Page,
						HasNext: got.Page < got.Pages,
					}
					assert.Equal(t, c.expected, gotPage)
				}
			})
		}
	})

	t.Run("SearchTile", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		t1 := mustInsert(t, subject, Track{
			OwnerID: otherUserID,
			Name:    "Edinburgh to Perth (other user)",
			Date:    ptime.DayStart(2020, 1, 1),
			Line: geometry.NewLine([]geometry.Point{
				{X: -3.1858980226860467, Y: 55.94856185047158},
				{X: -3.4500674996568534, Y: 56.39752331713589},
			}, nil),
		})

		t2 := mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "Edinburgh to Inverness (user)",
			Date:    ptime.DayStart(2020, 1, 20),
			Line: geometry.NewLine([]geometry.Point{
				{X: -3.1858980226860467, Y: 55.94856185047158},
				{X: -4.2153521067824045, Y: 57.47712128474947},
			}, nil),
		})

		mustInsert(t, subject, Track{
			OwnerID: userID,
			Name:    "Sacramento to LA",
			Date:    ptime.DayStart(2020, 1, 20),
			Line: geometry.NewLine([]geometry.Point{
				{X: -121.56585200965031, Y: 38.60389286188601},
				{X: -118.25801148118569, Y: 34.07023634492349},
			}, nil),
		})

		// See <https://chrishewett.com/blog/slippy-tile-explorer>
		edinburghTile := ZXY{Z: 8, X: 125, Y: 79}

		got, gotErr := subject.SearchTile(TrackSearchOpts{Owner: userID}, edinburghTile)
		require.NoError(t, gotErr)
		assertMVT(t, got, "default", []map[string]any{
			{
				"mvt_id":   2,
				"id":       t2.ID,
				"owner_id": userID,
				"name":     "Edinburgh to Inverness (user)",
			},
		})

		// This checks Edinburgh to Perth is in the tile (but not returned above)
		gotOtherUser, gotOtherUserErr := subject.SearchTile(TrackSearchOpts{Owner: otherUserID}, edinburghTile)
		require.NoError(t, gotOtherUserErr)
		assertMVT(t, gotOtherUser, "default", []map[string]any{
			{
				"mvt_id":   1,
				"id":       t1.ID,
				"owner_id": otherUserID,
				"name":     "Edinburgh to Perth (other user)",
			},
		})
	})
}
