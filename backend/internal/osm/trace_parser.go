package osm

import (
	"bytes"
	"errors"
	"fmt"
	"github.com/mmcdole/gofeed/rss"
	"regexp"
	"strconv"
	"time"
)

type traceMeta struct {
	ID       string
	Title    string
	Link     string
	Download string
	UserID   string
	PubDate  *time.Time
	Lng, Lat float64
}

func parseTraceFeed(value []byte) ([]traceMeta, error) {
	p := rss.Parser{}
	feed, err := p.Parse(bytes.NewReader(value))
	if err != nil {
		return nil, err
	}
	out := make([]traceMeta, 0, len(feed.Items))
	for _, v := range feed.Items {
		id, err := traceID(v.Link)
		if err != nil {
			return nil, err
		}

		userID, err := traceUserID(v.Link)
		if err != nil {
			return nil, err
		}

		geo, ok := v.Extensions["geo"]
		if !ok {
			return nil, errors.New("missing geo extension")
		}
		lngExt, ok := geo["long"]
		if !ok {
			return nil, errors.New("missing long")
		}
		lng, err := strconv.ParseFloat(lngExt[0].Value, 64)
		if err != nil {
			return nil, fmt.Errorf("parse lng: %w", err)
		}
		latExt, ok := geo["lat"]
		if !ok {
			return nil, errors.New("missing lat")
		}
		lat, err := strconv.ParseFloat(latExt[0].Value, 64)
		if err != nil {
			return nil, fmt.Errorf("parse lat: %w", err)
		}

		out = append(out, traceMeta{
			ID:       id,
			Title:    v.Title,
			Link:     v.Link,
			Download: fmt.Sprintf("https://www.openstreetmap.org/trace/%s/data", id),
			UserID:   userID,
			PubDate:  v.PubDateParsed,
			Lng:      lng,
			Lat:      lat,
		})
	}
	return out, nil
}

var feedItemLinkRe = regexp.MustCompile(`^https://www\.openstreetmap\.org/user/(.*?)/traces/(.*)$`)

func traceID(itemLink string) (string, error) {
	matches := feedItemLinkRe.FindSubmatch([]byte(itemLink))
	if matches == nil {
		return "", fmt.Errorf("failed to parse feed item link: %s", itemLink)
	}
	id := string(matches[2])
	return id, nil
}

func traceUserID(itemLink string) (string, error) {
	matches := feedItemLinkRe.FindSubmatch([]byte(itemLink))
	if matches == nil {
		return "", fmt.Errorf("failed to parse feed item link: %s", itemLink)
	}
	return string(matches[1]), nil
}
