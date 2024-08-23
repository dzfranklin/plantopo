package main

import (
	"cgt.name/pkg/go-mwclient"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

func doDownload() {
	w, err := mwclient.New("https://en.wikipedia.org/w/api.php", "github.com/dzfranklin/plantopo")
	if err != nil {
		panic(err)
	}

	q := w.NewQuery(map[string]string{
		"action":        "query",
		"format":        "json",
		"prop":          "pageprops",
		"list":          "",
		"meta":          "",
		"export":        "1",
		"generator":     "categorymembers",
		"formatversion": "2",
		"gcmtitle":      "Category:Munros",
		"gcmprop":       "ids|title",
	})

	for q.Next() {
		time.Sleep(time.Second)

		resp := q.Resp()
		respQuery, err := resp.GetObject("query")
		if err != nil {
			panic(err)
		}

		pages, err := respQuery.GetObjectArray("pages")
		if err != nil {
			panic(err)
		}
		wikipediaToWikibase := make(map[int64]string)
		for _, page := range pages {
			wikipediaID, err := page.GetInt64("pageid")
			if err != nil {
				panic(err)
			}

			props, err := page.GetObject("pageprops")
			if err != nil {
				log.Println("no pageprops for wikipediaID", wikipediaID)
				continue
			}
			wikibaseItem, err := props.GetString("wikibase_item")
			if err != nil {
				log.Println("no pageprops.wikibase_item for wikipediaID", wikipediaID)
				continue
			}

			wikipediaToWikibase[wikipediaID] = wikibaseItem
		}

		export, err := respQuery.GetString("export")
		if err != nil {
			panic(err)
		}

		var photos []mountainPhoto
		for wikipediaID, photo := range parseExport([]byte(export)) {
			wikibaseID, ok := wikipediaToWikibase[wikipediaID]
			if !ok {
				panic("id mismatch")
			}

			dbobihID := queryDBoBIHForWikibaseID(wikibaseID)
			if dbobihID == 0 {
				log.Println("MISSING DBoBIH ID FOR WIKIBASE", wikibaseID)
			}

			photo.ID = dbobihID
			photos = append(photos, photo)
		}

		photos = lookupInCommons(photos)

		for _, photo := range photos {
			photoJSON, err := json.Marshal(photo)
			if err != nil {
				panic(err)
			}
			fmt.Println(string(photoJSON))
		}
	}
	if err := q.Err(); err != nil {
		panic(err)
	}

}
