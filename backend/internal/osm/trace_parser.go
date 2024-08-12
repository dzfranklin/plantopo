package osm

import (
	"bytes"
	"fmt"
	"github.com/mmcdole/gofeed/rss"
	"regexp"
	"time"
)

// NOTE: We don't parse out the geo:long and geo:lat attributes because they aren't available right after a trace is
// added to the feed.

type traceMeta struct {
	ID       string
	Title    string
	Link     string
	Download string
	UserID   string
	PubDate  *time.Time
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

		out = append(out, traceMeta{
			ID:       id,
			Title:    v.Title,
			Link:     v.Link,
			Download: fmt.Sprintf("https://www.openstreetmap.org/trace/%s/data", id),
			UserID:   userID,
			PubDate:  v.PubDateParsed,
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
