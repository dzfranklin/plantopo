package psepa

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/tidwall/geojson/geometry"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

var mu sync.Mutex
var latest []Station
var hasData = false

type Station struct {
	ID            string
	NO            string
	Name          string
	Point         geometry.Point
	CatchmentID   string
	CatchmentName string
	Parameters    []ParameterName
}

type ParameterName struct {
	ID       string
	Name     string
	LongName string
}

func UpdateLoop(l *slog.Logger) {
	ctx := context.Background()

	c := &http.Client{
		Timeout: time.Minute * 5,
	}

	_ = ptime.SleepJitter(ctx, time.Millisecond*100, time.Millisecond*100)

	for {
		value, err := update(ctx, c)
		if err == nil {
			mu.Lock()
			latest = value
			hasData = true
			mu.Unlock()
		} else {
			if ctx.Err() != nil {
				return
			}
			l.Error("failed to update SEPA data", "error", err)
		}

		_ = ptime.SleepJitter(ctx, time.Hour, time.Minute*15)
	}
}

func Latest() ([]Station, error) {
	mu.Lock()
	defer mu.Unlock()

	if !hasData {
		return nil, errors.New("no SEPA data available yet")
	}

	return latest, nil
}

func update(ctx context.Context, c *http.Client) ([]Station, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://timeseries.sepa.org.uk/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=0&format=csv&request=getStationList&returnfields=station_no,station_id,station_name,catchment_id,catchment_name,station_latitude,station_longitude,parametertype_id,parametertype_name,parametertype_longname", nil)
	req.Header.Set("User-Agent", phttp.UserAgent)

	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status: %s", resp.Status)
	}

	r := bufio.NewReader(resp.Body)
	var header []string
	stations := make(map[string]*Station)
	for {
		line, err := r.ReadString('\n')
		if err == io.EOF {
			if len(strings.TrimSpace(line)) == 0 {
				break
			}
		} else if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)

		line = strings.ReplaceAll(line, "'-", "-") // I think this is some kind of escaping?

		fields := strings.Split(line, ";")

		if header == nil {
			header = fields
			continue
		}

		station := Station{}
		param := ParameterName{}
		for i, value := range fields {
			if i >= len(header) {
				return nil, fmt.Errorf("too many fields in line")
			}
			field := header[i]

			if value == "---" || value == "" {
				continue
			}

			switch field {
			case "station_no":
				station.NO = value
			case "station_id":
				station.ID = value
			case "station_name":
				station.Name = value
			case "catchment_id":
				station.CatchmentID = value
			case "catchment_name":
				station.CatchmentName = value
			case "station_latitude":
				lat, err := strconv.ParseFloat(value, 64)
				if err != nil {
					return nil, fmt.Errorf("failed to parse latitude: got %s", value)
				}
				station.Point.Y = lat
			case "station_longitude":
				long, err := strconv.ParseFloat(value, 64)
				if err != nil {
					return nil, fmt.Errorf("failed to parse longitude: got %s", value)
				}
				station.Point.X = long
			case "parametertype_id":
				param.ID = value
			case "parametertype_name":
				param.Name = value
			case "parametertype_longname":
				param.LongName = value
			}
		}

		if existing, ok := stations[station.ID]; ok {
			existing.Parameters = append(existing.Parameters, param)
		} else {
			station.Parameters = []ParameterName{param}
			stations[station.ID] = &station
		}
	}

	out := make([]Station, 0, len(stations))
	for _, station := range stations {
		out = append(out, *station)
	}

	return out, nil
}
