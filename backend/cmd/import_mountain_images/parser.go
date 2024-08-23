package main

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"io"
	"log"
	"strings"
)

func parseExport(export []byte) map[int64]mountainPhoto {
	var exportData struct {
		Pages []struct {
			ID    int64  `xml:"id"`
			Title string `xml:"title"`
			Text  []byte `xml:"revision>text"`
		} `xml:"page"`
	}
	if err := xml.Unmarshal(export, &exportData); err != nil {
		panic(err)
	}
	out := make(map[int64]mountainPhoto)
	for _, page := range exportData.Pages {
		if strings.HasPrefix(page.Title, "List of") {
			log.Println("Skipping", page.Title)
			continue
		}

		photo := parsePage(page.Text)
		if photo == nil {
			log.Println("Skipping", page.Title)
			continue
		}
		out[page.ID] = *photo
	}
	return out
}

func parsePage(wikitext []byte) *mountainPhoto {
	resp, err := phttp.Post(context.Background(), "https://wikitext.plantopo.com/v1/infobox",
		"text/plain", bytes.NewReader(wikitext))
	if err != nil {
		panic(err)
	}
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}
	var respData struct {
		Name struct {
			Text string
		}
		Photo struct {
			Text string
		}
		PhotoCaption struct {
			Text string
		} `json:"photo_caption"`
	}
	if err := json.Unmarshal(respBody, &respData); err != nil {
		panic(err)
	}

	if respData.Photo.Text == "" {
		return nil
	}

	return &mountainPhoto{
		Name:    respData.Name.Text,
		File:    respData.Photo.Text,
		Caption: respData.PhotoCaption.Text,
	}
}
