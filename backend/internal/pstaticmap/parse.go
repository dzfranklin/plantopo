package pstaticmap

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pgeo"
	"github.com/mazznoer/csscolorparser"
	"github.com/tidwall/geojson/geometry"
	"net/url"
	"strconv"
	"strings"
)

// ParseOpts parses a compact encoding suitable for query parameters
//
// The order that options are provided in matters. For example
// "w=400&h=280&f&lh=2&lw=3&lc=red&l=yos~FttquOhkM~eY&lc=green&l=aed~FlpquOylQty[&cr=5&ch=2&cc=rebeccapurple&c=-87.652%2041.848"
// will display a purple circle on top of a green line on top of a red line.
//
// General options:
// - w: width (pixels)
// - h: height (pixels)
// - lng: center longitude
// - lat: center latitude
// - zoom: zoom level
// - f: fit center and zoom to drawn
// - p: padding (pixels)
//
// Line options:
// - lc: line color (css color)
// - lw: line width (px)
// - lh: line halo width (px)
// - lhc: line halo color (css color)
// - l: line (Google Maps polyline encoding)
//
// Circle options
// - cc: circle color (css color)
// - cr: circle radius (px)
// - ch: circle halo width (px)
// - chc: circle halo color (css color)
// - c: circle (space separated longitude and latitude e.g. "1.1%2051.2"
func ParseOpts(input string) (out Opts, err error) {
	for input != "" {
		var key string
		key, input, _ = strings.Cut(input, "&")
		if strings.Contains(key, ";") {
			err = fmt.Errorf("invalid semicolon")
			return
		}
		if key == "" {
			continue
		}
		key, value, _ := strings.Cut(key, "=")
		key, err = url.QueryUnescape(key)
		if err != nil {
			err = fmt.Errorf("bad url escape")
			return
		}
		value, err = url.QueryUnescape(value)
		if err != nil {
			err = fmt.Errorf("bad url escape")
			return
		}

		err = parseOpt(&out, key, value)
		if err != nil {
			err = fmt.Errorf("bad opt: got %s=%s: %w", key, value, err)
			return
		}
	}
	return
}

// SerializeOpts serializes into the format parsed by ParseOpts
func SerializeOpts(opts Opts) string {
	var b strings.Builder
	serializeOpt(&b, "w", strconv.Itoa(opts.Width))
	serializeOpt(&b, "h", strconv.Itoa(opts.Height))
	if opts.Center != nil {
		serializeOpt(&b, "lng", serializeFloat(opts.Center.X))
		serializeOpt(&b, "lat", serializeFloat(opts.Center.Y))
	}
	if opts.Zoom != nil {
		serializeOpt(&b, "zoom", strconv.Itoa(*opts.Zoom))
	}
	if opts.Fit {
		b.WriteString("&f")
	}
	serializeOpt(&b, "p", serializeFloat(opts.Padding))

	for _, drawOp := range opts.Draw {
		switch op := drawOp.(type) {
		case Line:
			if op.Color != "" {
				serializeOpt(&b, "lc", op.Color)
			}
			if op.Width != 0 {
				serializeOpt(&b, "lw", serializeFloat(op.Width))
			}
			if op.HaloWidth != 0 {
				serializeOpt(&b, "lh", serializeFloat(op.HaloWidth))
			}
			if op.HaloColor != "" {
				serializeOpt(&b, "lhc", op.HaloColor)
			}
			if len(op.Points) >= 2 {
				serializeOpt(&b, "l", pgeo.EncodePolylinePoints(op.Points))
			}
		case Circle:
			if op.Color != "" {
				serializeOpt(&b, "cc", op.Color)
			}
			if op.Radius != 0 {
				serializeOpt(&b, "cr", serializeFloat(op.Radius))
			}
			if op.HaloWidth != 0 {
				serializeOpt(&b, "ch", serializeFloat(op.HaloWidth))
			}
			if op.HaloColor != "" {
				serializeOpt(&b, "chc", op.HaloColor)
			}
			serializeOpt(&b, "c", fmt.Sprintf("%f %f", op.Center.X, op.Center.Y))
		default:
			panic("unknown DrawOp")
		}
	}

	return b.String()
}

func serializeFloat(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

func parseOpt(out *Opts, k string, v string) (err error) {
	switch k {
	// General options
	case "w":
		out.Width, err = strconv.Atoi(v)
	case "h":
		out.Height, err = strconv.Atoi(v)
	case "lng":
		if out.Center == nil {
			out.Center = &geometry.Point{}
		}
		out.Center.X, err = strconv.ParseFloat(v, 64)
	case "lat":
		if out.Center == nil {
			out.Center = &geometry.Point{}
		}
		out.Center.Y, err = strconv.ParseFloat(v, 64)
	case "zoom":
		var z int
		z, err = strconv.Atoi(v)
		out.Zoom = &z
	case "f":
		out.Fit = true
	case "p":
		out.Padding, err = strconv.ParseFloat(v, 64)

	// Line options
	case "lc":
		out.defaultLine.Color, err = validateColor(v)
	case "lw":
		out.defaultLine.Width, err = strconv.ParseFloat(v, 64)
	case "lh":
		out.defaultLine.HaloWidth, err = strconv.ParseFloat(v, 64)
	case "lhc":
		out.defaultLine.HaloColor, err = validateColor(v)
	case "l":
		out.defaultLine.Points, err = pgeo.DecodePolylinePoints(v)
		out.Draw = append(out.Draw, out.defaultLine)

	// Circle options
	case "cc":
		out.defaultCircle.Color, err = validateColor(v)
	case "cr":
		out.defaultCircle.Radius, err = strconv.ParseFloat(v, 64)
	case "ch":
		out.defaultCircle.HaloWidth, err = strconv.ParseFloat(v, 64)
	case "chc":
		out.defaultCircle.HaloColor, err = validateColor(v)
	case "c":
		out.defaultCircle.Center, err = parseCircleCenter(v)
		out.Draw = append(out.Draw, out.defaultCircle)

	default:
		err = fmt.Errorf("unknown option: %s", k)
	}
	return
}

func serializeOpt(b *strings.Builder, key string, v string) {
	if b.Len() > 0 {
		b.WriteString("&")
	}
	b.WriteString(url.QueryEscape(key))
	b.WriteString("=")
	b.WriteString(url.QueryEscape(v))
}

func parseCircleCenter(v string) (p geometry.Point, err error) {
	lngS, latS, _ := strings.Cut(v, " ")
	p.X, err = strconv.ParseFloat(lngS, 64)
	if err != nil {
		return
	}
	p.Y, err = strconv.ParseFloat(latS, 64)
	if err != nil {
		return
	}
	return
}

func validateColor(value string) (string, error) {
	_, err := csscolorparser.Parse(value)
	return value, err
}
