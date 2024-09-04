package pflickr

import (
	"encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

var sampleSearchResp = `{
  "photos": {
    "page": 1,
    "pages": 5,
    "perpage": 1,
    "total": 10,
    "photo": [
      {
        "id": "904681",
        "owner": "63404131@N00",
        "secret": "336f7a301d",
        "server": "1",
        "farm": 1,
        "title": "mist rolling",
        "ispublic": 1,
        "isfriend": 0,
        "isfamily": 0,
        "license": "0",
        "dateupload": "1097968455",
        "datetaken": "2004-10-17 00:00:00",
        "datetakengranularity": 0,
        "datetakenunknown": "0",
        "ownername": "pamelaadam",
        "latitude": "57.133333",
        "longitude": "-2.483333",
        "accuracy": "16",
        "context": 0,
        "place_id": "Nh2xOPRQW7jOGw",
        "woeid": "19295",
        "geo_is_public": 1,
        "geo_is_contact": 0,
        "geo_is_friend": 0,
        "geo_is_family": 0,
        "url_l": "https://live.staticflickr.com/1/904681_336f7a301d_b.jpg",
        "height_l": 757,
        "width_l": 1024,
        "url_s": "https://live.staticflickr.com/1/904681_336f7a301d_m.jpg",
        "height_s": 177,
        "width_s": 240,
		"url_o": "https://live.staticflickr.com/1/904681_336f7a301d_o.jpg",
        "height_o": 757,
        "width_o": 1024
      }
    ]
  },
  "stat": "ok"
}`

func TestUnmarshalSearchResponse(t *testing.T) {
	var got struct {
		Photos searchPage `json:"photos"`
	}
	err := json.Unmarshal([]byte(sampleSearchResp), &got)
	require.NoError(t, err)

	gotPage := got.Photos
	assert.Equal(t, 1, gotPage.Page)
	assert.Equal(t, 5, gotPage.Pages)
	assert.Equal(t, 1, gotPage.PerPage)
	assert.Equal(t, 10, gotPage.Total)
	assert.Equal(t, 1, len(gotPage.Photo))

	gotPhoto := gotPage.Photo[0]

	assert.WithinDuration(t, time.Unix(1097968455, 0), time.Time(gotPhoto.DateUpload), time.Second)
	assert.WithinDuration(t, time.Date(2004, 10, 17, 0, 0, 0, 0, time.UTC),
		time.Time(gotPhoto.DateTaken), time.Second)

	gotPhoto.DateUpload = fuzzyDate{}
	gotPhoto.DateTaken = fuzzyDate{}
	expected := searchPagePhoto{
		ID:             "904681",
		Owner:          "63404131@N00",
		License:        0,
		OwnerName:      "pamelaadam",
		Latitude:       57.133333,
		Longitude:      -2.483333,
		Title:          "mist rolling",
		OriginalURL:    "https://live.staticflickr.com/1/904681_336f7a301d_o.jpg",
		OriginalWidth:  1024,
		OriginalHeight: 757,
		LargeURL:       "https://live.staticflickr.com/1/904681_336f7a301d_b.jpg",
		LargeWidth:     1024,
		LargeHeight:    757,
		SmallURL:       "https://live.staticflickr.com/1/904681_336f7a301d_m.jpg",
		SmallHeight:    177,
		SmallWidth:     240,
	}
	assert.Equal(t, expected, gotPhoto)
}

func TestParsePhotoWithFuzzyFloat(t *testing.T) {
	data := `{"latitude":1,"longitude":2}`
	var got searchPagePhoto
	err := json.Unmarshal([]byte(data), &got)
	require.NoError(t, err)
	assert.Equal(t, float64(1), float64(got.Latitude))
	assert.Equal(t, float64(2), float64(got.Longitude))
}
