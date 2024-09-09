package pgeograph

import (
	"bufio"
	"compress/gzip"
	_ "embed"
	"errors"
	"fmt"
	"golang.org/x/text/encoding/charmap"
	"io"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"
)

type gridimage struct {
	// gridimage_base

	GridimageID int
	UserID      int
	Realname    string
	Title       string
	ImageTaken  time.Time
	WGS84Lat    float64
	WGS84Long   float64

	// gridimage_size

	Width          int
	Height         int
	OriginalWidth  int
	OriginalHeight int
}

func parseDump(
	cutoff int,
	baseFile, sizeFile io.Reader,
) (nextCutoff int, gridimages map[int]*gridimage, err error) {
	defer func() {
		if excp := recover(); excp != nil {
			switch v := excp.(type) {
			case string:
				err = errors.New(v)
			case error:
				err = v
			default:
				err = errors.New(fmt.Sprint(v))
			}
		}
	}()

	gridimages = parseBaseDump(cutoff, baseFile)

	parseSizeDump(cutoff, sizeFile, gridimages)

	nextCutoff = cutoff
	for id := range gridimages {
		nextCutoff = max(nextCutoff, id)
	}

	return
}

func parseBaseDump(cutoff int, baseFile io.Reader) map[int]*gridimage {
	r := readDumpFile(baseFile)

	header, headerErr := r.Read()
	if headerErr != nil {
		panic(headerErr)
	}

	idI := colIndex(header, "gridimage_id")
	userIDI := colIndex(header, "user_id")
	realnameI := colIndex(header, "realname")
	titleI := colIndex(header, "title")
	takenI := colIndex(header, "imagetaken")
	latI := colIndex(header, "wgs84_lat")
	lngI := colIndex(header, "wgs84_long")

	out := make(map[int]*gridimage)
	for {
		row, rowErr := r.Read()
		if errors.Is(rowErr, io.EOF) {
			break
		} else if rowErr != nil {
			panic(rowErr)
		}

		id := intValue(row[idI])

		if id > cutoff {
			out[id] = &gridimage{
				GridimageID: id,
				UserID:      intValue(row[userIDI]),
				Realname:    stringValue(row[realnameI]),
				Title:       stringValue(row[titleI]),
				ImageTaken:  dateValue(row[takenI]),
				WGS84Lat:    floatValue(row[latI]),
				WGS84Long:   floatValue(row[lngI]),
			}
		}
	}
	return out
}

func parseSizeDump(cutoff int, sizeFile io.Reader, gridimages map[int]*gridimage) {
	r := readDumpFile(sizeFile)

	header, headerErr := r.Read()
	if headerErr != nil {
		panic(headerErr)
	}

	idI := colIndex(header, "gridimage_id")
	widthI := colIndex(header, "width")
	heightI := colIndex(header, "height")
	originalWidthI := colIndex(header, "original_width")
	originalHeightI := colIndex(header, "original_height")

	for {
		row, rowErr := r.Read()
		if errors.Is(rowErr, io.EOF) {
			break
		} else if rowErr != nil {
			panic(rowErr)
		}

		id := intValue(row[idI])

		if id <= cutoff {
			continue
		}

		entry, hasEntry := gridimages[id]
		if !hasEntry {
			continue
		}

		entry.Width = intValue(row[widthI])
		entry.Height = intValue(row[heightI])
		entry.OriginalWidth = intValue(row[originalWidthI])
		entry.OriginalHeight = intValue(row[originalHeightI])
	}
}

func readDumpFile(input io.Reader) *dumpFileReader {
	unzipped, unzipErr := gzip.NewReader(input)
	if unzipErr != nil {
		panic(unzipErr)
	}
	decoded := charmap.ISO8859_1.NewDecoder().Reader(unzipped)

	return &dumpFileReader{bufio.NewReader(decoded)}
}

type dumpFileReader struct {
	inner *bufio.Reader
}

func (r *dumpFileReader) Read() ([]string, error) {
	s, readErr := r.inner.ReadString('\n')
	if readErr != nil {
		return nil, readErr
	}

	parts := strings.Split(s, "\t")
	for i, part := range parts {
		parts[i] = strings.ReplaceAll(strings.ReplaceAll(part, "\\t", "\t"), "\\n", "\n")
	}

	return parts, nil
}

func colIndex(header []string, col string) int {
	i := slices.Index(header, col)
	if i < 0 {
		panic(col + " not in header")
	}
	return i
}

func intValue(v string) int {
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		panic(err)
	}
	if n > math.MaxInt {
		panic("n too big")
	}
	return int(n)
}

func stringValue(v string) string {
	return strings.TrimSpace(v)
}

func floatValue(v string) float64 {
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		panic(err)
	}
	return f
}

func dateValue(v string) time.Time {
	s := stringValue(v)

	parts := strings.Split(s, "-")
	if len(parts) != 3 {
		panic("malformed time: " + v)
	}
	y := parts[0]
	m := parts[1]
	d := parts[2]

	if y == "0000" {
		return time.Time{}
	}

	if m == "00" {
		m = "01"
	}
	if d == "00" {
		d = "01"
	}

	t, err := time.Parse("2006-01-02", fmt.Sprintf("%s-%s-%s", y, m, d))

	if err != nil {
		panic(err)
	}
	return t
}
