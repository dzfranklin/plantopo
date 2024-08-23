package main

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/net/html"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"io"
	"log"
	"os"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
)

var allowedLicenses = []string{
	"CC-BY-2.0", "CC-BY-2.5", "CC-BY-3.0", "CC-BY-SA-2.0", "CC-BY-SA-2.0-DE", "CC-BY-SA-2.5", "CC-BY-SA-2.5,2.0,1.0",
	"CC-BY-SA-3.0", "CC-BY-SA-3.0,2.5,2.0,1.0", "CC-BY-SA-3.0-migrated", "CC-BY-SA-3.0-migrated-with-disclaimers",
	"CC-BY-SA-4.0", "CC-Zero", "PD", "PD-user",
}

var cleanupOrigUploaderRe = regexp.MustCompile(`(?:(?:[tT]he\s)*[Oo]riginal uploader was )?(.*) at .*`)

func doImport(pathname string) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		panic("Missing DATABASE_URL")
	}
	db, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		panic(err)
	}
	repo := prepo.NewBritishAndIrishHills(db)

	f, err := os.Open(pathname)
	if err != nil {
		panic(err)
	}
	defer func() { _ = f.Close() }()
	dec := json.NewDecoder(f)
	for {
		var photo mountainPhoto
		err := dec.Decode(&photo)
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			panic(err)
		}

		// Validate

		if photo.ID == 0 {
			panic("Photo missing ID: " + photo.Name)
		}

		if containsHTML(photo.Name) {
			panic("name contains html: " + photo.Name)
		}

		if !strings.HasPrefix(photo.File, "http://") && !strings.HasPrefix(photo.File, "https://") {
			panic("Invalid file: " + photo.File)
		}

		if containsHTML(photo.Caption) {
			panic("html in captions unimplemented")
		}

		hasAllowedLicense := false
		for _, license := range photo.Licenses {
			if slices.Contains(allowedLicenses, license) {
				hasAllowedLicense = true
				break
			}
		}
		if !hasAllowedLicense {
			panic("No allowed license in: " + strings.Join(photo.Licenses, ", "))
		}

		if photo.Size == 0 || photo.Width == 0 || photo.Height == 0 {
			panic("Missing size info: " + photo.Name)
		}

		uploadedAt, err := time.Parse(time.RFC3339, photo.UploadDate)
		if err != nil {
			panic("invalid uploadDate: " + photo.UploadDate)
		}

		if photo.Author == "" || photo.Source == "" {
			panic("missing attribution: " + photo.Name)
		}

		// Clean up

		photo.Author = innerText(photo.Author)
		photo.Author = strings.ReplaceAll(photo.Author, " (talk)", "")
		photo.Author = cleanupOrigUploaderRe.ReplaceAllString(photo.Author, "$1")

		photo.Source, photo.SourceLink = parseSource(photo.Source)
		badSourceLinks := []string{"", "https://en.wikipedia.org/", "https://iw.toolforge.org/commonshelper/"}
		if slices.Contains(badSourceLinks, photo.SourceLink) {
			re := regexp.MustCompile(`(^https://upload.wikimedia.org/wikipedia/commons/./../)`)
			photo.SourceLink = re.ReplaceAllString(photo.File, "https://commons.wikimedia.org/wiki/File:")
		}

		insertOpts := prepo.InsertBritishOrIrishHillPhotoOpts{
			HillID:     photo.ID,
			Caption:    photo.Caption,
			Licenses:   photo.Licenses,
			Source:     photo.File,
			Size:       photo.Size,
			Width:      photo.Width,
			Height:     photo.Height,
			UploadedAt: uploadedAt,
			Author:     photo.Author,
			SourceText: photo.Source,
			SourceLink: photo.SourceLink,
			Importer:   "import_mountain_images/wikipedia",
		}
		log.Printf("%+v\n", insertOpts)
		if err := repo.InsertPhoto(insertOpts); err != nil {
			panic(err)
		}
	}
	log.Println("All done")
}

func containsHTML(v string) bool {
	z := html.NewTokenizer(strings.NewReader(v))
	for {
		tok := z.Next()
		if tok == html.ErrorToken {
			break
		}

		if tok != html.TextToken {
			return true
		}
	}
	if err := z.Err(); err != nil && !errors.Is(err, io.EOF) {
		panic(err)
	}
	return false
}

var spaceRunRe = regexp.MustCompile(`\s+`)
var nonTextTags = []string{"style"}

func innerText(v string) string {
	var s strings.Builder
	z := html.NewTokenizer(strings.NewReader(v))
	skip := 0
	for {
		if ty := z.Next(); ty == html.ErrorToken {
			break
		}
		tok := z.Token()

		switch tok.Type {
		case html.StartTagToken:
			if slices.Contains(nonTextTags, tok.Data) {
				skip++
			}
		case html.EndTagToken:
			if slices.Contains(nonTextTags, tok.Data) {
				skip--
			}
		case html.TextToken:
			if skip < 1 {
				s.WriteString(tok.Data)
			}
		default:
		}
	}
	if err := z.Err(); err != nil && !errors.Is(err, io.EOF) {
		panic(err)
	}
	return strings.TrimSpace(spaceRunRe.ReplaceAllString(strings.ReplaceAll(s.String(), "\n", ""), " "))
}

func parseSource(v string) (string, string) {
	if !containsHTML(v) {
		return strings.TrimSpace(v), ""
	}

	var link string
	var s strings.Builder

	z := html.NewTokenizer(strings.NewReader(v))
	skip := 0
	for {
		if ty := z.Next(); ty == html.ErrorToken {
			break
		}
		tok := z.Token()

		switch tok.Type {
		case html.StartTagToken:
			if tok.Data == "a" {
				for _, attr := range tok.Attr {
					if attr.Namespace == "" && attr.Key == "href" {
						link = attr.Val
					}
				}
			}

			if slices.Contains(nonTextTags, tok.Data) {
				skip++
			}
		case html.EndTagToken:
			if slices.Contains(nonTextTags, tok.Data) {
				skip--
			}
		case html.TextToken:
			if skip < 1 {
				s.WriteString(spaceRunRe.ReplaceAllString(strings.ReplaceAll(tok.Data, "\n", ""), " "))
			}
		default:
		}
	}
	if err := z.Err(); err != nil && !errors.Is(err, io.EOF) {
		panic(err)
	}
	text := strings.TrimSpace(s.String())

	isFirst := true
	unTitleCase := runes.Map(func(r rune) rune {
		if isFirst {
			isFirst = false
			return unicode.ToLower(r)
		}
		return r
	})
	transformed, _, err := transform.String(unTitleCase, text)
	if err == nil {
		text = transformed
	}

	text = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(text, "from "), "."))

	if strings.HasPrefix(link, "//") {
		link = "https:" + link
	}

	return text, link
}
