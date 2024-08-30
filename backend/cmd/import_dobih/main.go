package main

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"github.com/cridenour/go-postgis"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Println("Usage: import_dobih <filename>")
		os.Exit(1)
	}
	fname := os.Args[1]

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		panic("Missing DATABASE_URL")
	}

	f, err := os.Open(fname)
	if err != nil {
		panic(err)
	}
	defer func(f *os.File) {
		err := f.Close()
		if err != nil {
			panic(err)
		}
	}(f)

	db, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		panic(err)
	}
	err = db.Ping(context.Background())
	if err != nil {
		panic(err)
	}

	reader := csv.NewReader(f)
	fields, err := reader.Read()
	if err != nil {
		panic(err)
	}
	src := &csvSource{r: reader, fields: fields}

	rows, err := db.CopyFrom(context.Background(), []string{"british_and_irish_hills"}, columnNames, src)
	if err != nil {
		panic(err)
	}
	fmt.Println("Imported", rows, "rows")
}

type csvSource struct {
	r      *csv.Reader
	fields []string
	row    []string
	err    error
}

func (src *csvSource) Next() bool {
	src.row, src.err = src.r.Read()
	return src.err == nil
}

var columnNames = []string{
	"id",
	"name",
	"point",
	"smc_parent_id",
	"classification",
	"map_50k",
	"map_25k",
	"metres",
	"grid_ref",
	"grid_ref_10",
	"drop",
	"col_grid_ref",
	"col_height",
	"feature",
	"observations",
	"survey",
	"country",
	"revision",
	"comments",
}

func (src *csvSource) Values() ([]any, error) {
	classificationField := src.get("Classification")
	var classification []string
	if classificationField != nil {
		classification = strings.Split(*classificationField, ",")
	}
	return []any{
		*src.getInt("Number"),
		*src.get("Name"),
		postgis.Point{X: *src.getFloat("Longitude"), Y: *src.getFloat("Latitude")},
		src.getInt("Parent (SMC)"),
		classification,
		src.get("Map 1:50k"),
		src.get("Map 1:25k"),
		src.get("Metres"),
		src.get("Grid ref"),
		src.get("Grid ref 10"),
		src.get("Drop"),
		src.get("Col grid ref"),
		src.get("Col height"),
		src.get("Feature"),
		src.get("Observations"),
		src.get("Survey"),
		src.get("CountryAlpha2"),
		src.get("Revision"),
		src.get("Comments"),
	}, nil
}

func (src *csvSource) Err() error {
	if src.err != nil && !errors.Is(src.err, io.EOF) {
		return src.err
	} else {
		return nil
	}
}

func (src *csvSource) get(field string) *string {
	idx := slices.Index(src.fields, field)
	if idx < 0 {
		panic("unknown field: " + field)
	}
	s := src.row[idx]
	if s == "" {
		return nil
	}
	return &s
}

func (src *csvSource) getInt(field string) *int64 {
	s := src.get(field)
	if s == nil {
		return nil
	}
	v, err := strconv.ParseInt(*s, 10, 64)
	if err != nil {
		panic(err)
	}
	return &v
}

func (src *csvSource) getFloat(field string) *float64 {
	s := src.get(field)
	if s == nil {
		return nil
	}
	v, err := strconv.ParseFloat(*s, 64)
	if err != nil {
		panic(err)
	}
	return &v
}
