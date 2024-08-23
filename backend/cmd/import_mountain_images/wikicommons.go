package main

import (
	"encoding/xml"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"log"
	"net/url"
	"strings"
)

func lookupInCommons(inputs []mountainPhoto) []mountainPhoto {
	var files []string
	for _, p := range inputs {
		name := url.QueryEscape(strings.ReplaceAll(p.File, " ", "_"))
		files = append(files, name)
	}

	resp := phttp.MustGet("https://magnus-toolserver.toolforge.org/commonsapi.php?meta&image=" + strings.Join(files, "|"))
	var data struct {
		Images []struct {
			File struct {
				Name string `xml:"name"`
				URLs []struct {
					File string `xml:"file"`
				} `xml:"urls"`
				Size       int    `xml:"size"`
				Width      int    `xml:"width"`
				Height     int    `xml:"height"`
				UploadDate string `xml:"upload_date"`
				Author     string `xml:"author"`
				Source     string `xml:"source"`
			} `xml:"file"`
			Licenses struct {
				License []struct {
					Name string `xml:"name"`
				} `xml:"license"`
			} `xml:"licenses"`
		} `xml:"image"`
	}
	if err := xml.Unmarshal(resp, &data); err != nil {
		panic(err)
	}

	var out []mountainPhoto
	for i, img := range data.Images {
		v := inputs[i]

		if len(img.File.URLs) == 0 {
			log.Println("No URLs for", fmt.Sprintf("%+v", v))
			continue
		}
		v.File = img.File.URLs[0].File

		for _, license := range img.Licenses.License {
			v.Licenses = append(v.Licenses, license.Name)
		}

		v.Size = img.File.Size
		v.Width = img.File.Width
		v.Height = img.File.Height
		v.UploadDate = img.File.UploadDate
		v.Author = img.File.Author
		v.Source = img.File.Source

		out = append(out, v)
	}
	return out
}
