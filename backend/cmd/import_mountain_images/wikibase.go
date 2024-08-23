package main

import (
	"context"
	"encoding/json"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"io"
	"strconv"
)

func queryDBoBIHForWikibaseID(wikibaseID string) int32 {
	resp, err := phttp.Get(context.Background(),
		"https://www.wikidata.org/w/rest.php/wikibase/v0/entities/items/"+wikibaseID+"/statements?property=P6515")
	if err != nil {
		panic(err)
	}
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}
	var respData struct {
		P6515 []struct {
			Value struct {
				Content string
			}
		}
	}
	if err := json.Unmarshal(respBody, &respData); err != nil {
		panic(err)
	}
	if len(respData.P6515) == 0 {
		return 0
	}
	dbobihID, err := strconv.ParseInt(respData.P6515[0].Value.Content, 10, 64)
	if err != nil {
		panic(err)
	}
	return int32(dbobihID)
}
