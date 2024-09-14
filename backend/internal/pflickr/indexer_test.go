package pflickr

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/throttled/throttled/v2"
	"github.com/throttled/throttled/v2/store/memstore"
	"github.com/tidwall/geojson/geometry"
	"math"
	"testing"
	"time"
)

type mockFlickr struct {
	photos                []searchPagePhoto
	searches              int
	spuriousZeroCountdown int
}

var mockPhotos []searchPagePhoto
var mockTime time.Time

const mockPhotosUnableToBeIndexed = 1000

func init() {
	t := ptime.DayStart(2018, 1, 1)
	nextID := 1

	for t.Before(ptime.DayStart(2020, 1, 1)) {
		for range 5000 { // intentionally a little more than the max search window
			t = t.Add(time.Second)
			mockPhotos = append(mockPhotos, mockPhoto(nextID, t))
			nextID++
			// intentionally a simultaneous upload time
			mockPhotos = append(mockPhotos, mockPhoto(nextID, t))
			nextID++
		}
		t = t.AddDate(1, 0, 0)
	}

	// intentionally more than the max search window with no separating time
	for range 3000 + mockPhotosUnableToBeIndexed {
		mockPhotos = append(mockPhotos, mockPhoto(nextID, t))
		nextID++
	}

	mockTime = t.Add(indexUploadedSince + time.Hour)
}

func mockPhoto(id int, date time.Time) searchPagePhoto {
	return searchPagePhoto{
		ID:             fmt.Sprintf("%d", id),
		Owner:          "owner",
		License:        1,
		OwnerName:      "Owner Name",
		Longitude:      1.5,
		Latitude:       1.5,
		DateUpload:     fuzzyDate(date),
		DateTaken:      fuzzyDate(date),
		Title:          fmt.Sprintf("Title %d", id),
		OriginalURL:    "https://mock.plantopo.com/original...",
		OriginalWidth:  1024,
		OriginalHeight: 675,
		SmallURL:       "https://mock.plantopo.com/small...",
		SmallWidth:     512,
		SmallHeight:    338,
	}
}

func newMockFlickr() *mockFlickr {
	return &mockFlickr{photos: mockPhotos, spuriousZeroCountdown: 3}
}

func mockSingleRegionIndexer(t *testing.T, initialTime time.Time) (*MockindexerRepo, *Indexer) {
	t.Helper()
	l := ptest.NewTestLogger(t)
	repo := NewMockindexerRepo(t)
	flickr := newMockFlickr()
	clock := NewMockclockProvider(t)

	indexer := &Indexer{l: l, flickr: flickr, repo: repo, clock: clock}

	clock.EXPECT().Now().Return(mockTime)

	rect := geometry.Rect{Min: geometry.Point{X: 1, Y: 1}, Max: geometry.Point{X: 2, Y: 2}}
	region := prepo.FlickrIndexRegion{ID: 1, Name: "region", Rect: rect}
	repo.EXPECT().FlickrIndexRegions().Return([]prepo.FlickrIndexRegion{region}, nil)

	progressTime := initialTime
	repo.EXPECT().GetFlickrIndexProgress(1).RunAndReturn(func(_ int) (time.Time, error) {
		return progressTime, nil
	})
	repo.EXPECT().UpdateFlickrIndexProgress(1, mock.Anything).
		Run(func(_ int, latest time.Time) {
			progressTime = latest
		}).
		Return(nil)

	return repo, indexer
}

func (m *mockFlickr) searchForIndex(_ context.Context, params searchParams) (searchPage, error) {
	m.searches++

	pageSize := 250
	matching := pslices.Filter(m.photos, func(photo searchPagePhoto) bool {
		du := time.Time(photo.DateUpload)
		return (du.Equal(params.MinUploadDate) || du.After(params.MinUploadDate)) &&
			(du.Equal(params.MaxUploadDate) || du.Before(params.MaxUploadDate))
	})

	var photo []searchPagePhoto
	offset := (params.Page - 1) * pageSize
	if offset < len(matching) {
		photo = matching[offset:min(len(matching), offset+pageSize)]
	}

	// Sometimes flickr sends a zero page incorrectly. It seems to happen in more popular areas with wider date ranges.
	// We mock it arbitrarily so we can check we handle it.
	if len(photo) > 0 && params.Page == 1 {
		if m.spuriousZeroCountdown > 0 {
			m.spuriousZeroCountdown--
			if m.spuriousZeroCountdown == 0 {
				return searchPage{Page: 1, PerPage: 100}, nil
			}
		}
	}

	page := searchPage{
		Page:    params.Page,
		Pages:   int(math.Ceil(float64(len(matching)) / float64(pageSize))),
		PerPage: pageSize,
		Total:   len(matching),
		Photo:   photo,
	}
	return page, nil
}

func expectPhotosToBeImported(t *testing.T, repo *MockindexerRepo, cutoff time.Time) {
	got := make(map[string]int)

	repo.EXPECT().ImportIfNotPresent(mock.Anything).Run(func(photo prepo.Geophoto) {
		got[photo.SourceID]++
	}).Return(nil)

	t.Cleanup(func() {
		excess := 0
		missing := 0
		for _, photo := range mockPhotos {
			du := time.Time(photo.DateUpload)
			if du.Before(cutoff) {
				if got[photo.ID] != 0 {
					t.Error("expected photo not to be imported", photo.ID)
				}
				continue
			}

			if got[photo.ID] == 0 {
				missing++
			}

			if got[photo.ID] > 1 {
				excess += got[photo.ID] - 1
			}
		}
		assert.Lessf(t, excess, len(mockPhotos)/3, "expected not too many excess imports")
		assert.Equal(t, mockPhotosUnableToBeIndexed, missing)
	})
}

func TestIndexFromScratch(t *testing.T) {
	repo, indexer := mockSingleRegionIndexer(t, time.Time{})
	expectPhotosToBeImported(t, repo, time.Time{})

	didIndex, err := indexer.IndexOnce(context.Background())
	require.NoError(t, err)
	assert.True(t, didIndex)
}

func TestPartialIndex(t *testing.T) {
	cutoffTime := mockTime.AddDate(-1, 0, 0)
	repo, indexer := mockSingleRegionIndexer(t, cutoffTime)
	expectPhotosToBeImported(t, repo, cutoffTime)

	didIndex, err := indexer.IndexOnce(context.Background())
	require.NoError(t, err)
	assert.True(t, didIndex)
}

func TestSettles(t *testing.T) {
	repo, indexer := mockSingleRegionIndexer(t, time.Time{})
	expectPhotosToBeImported(t, repo, time.Time{})

	didIndex1, err := indexer.IndexOnce(context.Background())
	require.NoError(t, err)
	assert.True(t, didIndex1)

	searchesPre := indexer.flickr.(*mockFlickr).searches
	didIndex2, err := indexer.IndexOnce(context.Background())
	require.NoError(t, err)
	require.False(t, didIndex2)
	searchesPost := indexer.flickr.(*mockFlickr).searches

	assert.Equal(t, searchesPre, searchesPost)
}

func TestSmoke(t *testing.T) {
	t.Skip()

	// SETUP

	l := ptest.NewTestLogger(t)

	api := smokeAPIClient(t)

	region := prepo.FlickrIndexRegion{
		ID:   1,
		Name: "faroe",
		Rect: geometry.Rect{
			Min: geometry.Point{X: -7.891561, Y: 61.302513},
			Max: geometry.Point{X: -6.061860, Y: 62.493118},
		},
	}
	repo := NewMockindexerRepo(t)
	repo.EXPECT().FlickrIndexRegions().Return([]prepo.FlickrIndexRegion{region}, nil)

	progressTime := ptime.DayStart(2024, 01, 01)
	repo.EXPECT().GetFlickrIndexProgress(1).Return(progressTime, nil)
	repo.EXPECT().UpdateFlickrIndexProgress(1, mock.Anything).
		Run(func(_ int, latest time.Time) {
			progressTime = latest
		}).
		Return(nil)

	var got []prepo.Geophoto
	repo.EXPECT().ImportIfNotPresent(mock.Anything).Run(func(photo prepo.Geophoto) {
		got = append(got, photo)
	}).Return(nil)

	indexer := &Indexer{l: l, flickr: api, repo: repo}

	// RUN

	_, err := indexer.IndexOnce(context.Background())
	require.NoError(t, err)

	// CHECK

	var dupSourceIDs []string
	uniqueIDs := make(map[string]bool)
	for _, photo := range got {
		if uniqueIDs[photo.SourceID] {
			dupSourceIDs = append(dupSourceIDs, photo.SourceID)
			continue
		}
		uniqueIDs[photo.SourceID] = true
	}
	assert.Less(t, len(dupSourceIDs), len(got)/2)

	assert.NotEmpty(t, got)
}

func TestSmokeFromScratch(t *testing.T) {
	t.Skip()

	// SETUP

	l := ptest.NewTestLogger(t)

	api := smokeAPIClient(t)

	region := prepo.FlickrIndexRegion{
		ID:   1,
		Name: "faroe",
		Rect: geometry.Rect{
			Min: geometry.Point{X: -7.891561, Y: 61.302513},
			Max: geometry.Point{X: -6.061860, Y: 62.493118},
		},
	}
	repo := NewMockindexerRepo(t)
	repo.EXPECT().FlickrIndexRegions().Return([]prepo.FlickrIndexRegion{region}, nil)

	var progressTime time.Time
	repo.EXPECT().GetFlickrIndexProgress(1).Return(progressTime, nil)
	repo.EXPECT().UpdateFlickrIndexProgress(1, mock.Anything).
		Run(func(_ int, latest time.Time) {
			progressTime = latest
		}).
		Return(nil)

	got := make(map[string][]prepo.Geophoto)
	repo.EXPECT().ImportIfNotPresent(mock.Anything).Run(func(photo prepo.Geophoto) {
		got[photo.SourceID] = append(got[photo.SourceID], photo)
		imports := len(got[photo.SourceID])
		if imports > 1 {
			t.Log("--- dup import", photo.SourceID, "imported", imports, "times")
		}
	}).Return(nil)

	indexer := &Indexer{l: l, flickr: api, repo: repo}

	// RUN

	_, err := indexer.IndexOnce(context.Background())
	require.NoError(t, err)

	assert.NotEmpty(t, got)
}

func smokeAPIClient(t *testing.T) *API {
	ptest.LoadDevEnv(t)
	cfg := pconfig.Read()

	throttleStore, err := memstore.NewCtx(1)
	require.NoError(t, err)
	throttle, err := throttled.NewGCRARateLimiterCtx(throttleStore, apiQuota)
	require.NoError(t, err)

	l := ptest.NewTestLogger(t)

	c := phttp.NewJSONClient("https://www.flickr.com/services/rest/")
	c.AddCommonQueryParam("api_key", cfg.Flickr.APIKey)

	return &API{
		l:        l,
		c:        c,
		throttle: throttle,
	}
}
