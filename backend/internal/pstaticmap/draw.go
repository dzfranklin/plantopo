package pstaticmap

import (
	"bytes"
	"fmt"
	"github.com/mazznoer/csscolorparser"
	"github.com/tidwall/geojson/geometry"
	"golang.org/x/net/html"
	"io"
	"math"
	"strings"
)

const (
	defaultColor     = "#000000"
	defaultHaloColor = "#ffffff"
)

type Circle struct {
	Center    geometry.Point
	Color     string
	Radius    float64
	HaloColor string
	HaloWidth float64
}

type Line struct {
	Points    []geometry.Point
	Color     string
	Width     float64
	HaloColor string
	HaloWidth float64
}

type DrawOp interface {
	visit(view viewport, b io.Writer) error
	extent(maybeView *viewport) geometry.Rect
}

var _ = []DrawOp{Circle{}, Line{}}

func extentOf(maybeView *viewport, ops []DrawOp) geometry.Rect {
	extent := ops[0].extent(maybeView)
	for _, op := range ops[1:] {
		opExt := op.extent(maybeView)
		extent.Min.X = math.Min(extent.Min.X, opExt.Min.X)
		extent.Min.Y = math.Min(extent.Min.Y, opExt.Min.Y)
		extent.Max.X = math.Max(extent.Max.X, opExt.Max.X)
		extent.Max.Y = math.Max(extent.Max.Y, opExt.Max.Y)
	}
	return extent
}

func drawSvg(view viewport, ops []DrawOp) ([]byte, error) {
	var b bytes.Buffer

	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d">`,
		view.width, view.height)

	// Complies with <https://osmfoundation.org/wiki/Licence/Attribution_Guidelines#Static_images>
	fmt.Fprint(&b, `<text y="100%" x="100%" dy="-5" dx="-5" `+
		`alignment-baseline="text-after-edge" text-anchor="end" `+
		`stroke="white" stroke-width="0.4em" fill="black" paint-order="stroke" stroke-linejoin="round" `+
		`font-family="sans-serif" font-size="12px">`+
		`© OpenStreetMap</text>`)

	for _, opt := range ops {
		if err := opt.visit(view, &b); err != nil {
			return nil, err
		}
	}

	fmt.Fprint(&b, "</svg>")

	return b.Bytes(), nil
}

func (c Circle) extent(view *viewport) geometry.Rect {
	e := geometry.Rect{Min: c.Center, Max: c.Center}

	if view != nil {
		x := view.lngToX(c.Center.X)
		y := view.latToY(c.Center.Y)

		e.Min.X = view.xToLng(x - c.Radius/tileSize)
		e.Min.Y = view.yToLat(y - c.Radius/tileSize)
		e.Max.X = view.xToLng(x + c.Radius/tileSize)
		e.Max.Y = view.yToLat(y + c.Radius/tileSize)
	}

	return e
}

func (c Circle) visit(view viewport, b io.Writer) error {
	if c.Radius == 0 {
		c.Radius = 5
	}
	if c.HaloColor == "" {
		c.HaloColor = defaultHaloColor
	}
	if c.Color == "" {
		c.Color = defaultColor
	}

	haloColor, err := csscolorparser.Parse(c.HaloColor)
	if err != nil {
		return err
	}

	color, err := csscolorparser.Parse(c.Color)
	if err != nil {
		return err
	}

	x := view.lngToPixel(c.Center.X)
	y := view.latToPixel(c.Center.Y)
	if c.HaloWidth != 0 {
		fmt.Fprintf(b, `<circle cx="%d" cy="%d" r="%f" fill="%s"/>`,
			x, y, c.Radius+c.HaloWidth, html.EscapeString(haloColor.HexString()))
	}
	fmt.Fprintf(b, `<circle cx="%d" cy="%d" r="%f" fill="%s"/>`,
		x, y, c.Radius, html.EscapeString(color.HexString()))
	return nil
}

func (l Line) extent(view *viewport) geometry.Rect {
	line := geometry.NewLine(l.Points, nil)
	e := line.Rect()

	if view != nil {
		e.Min.X = view.xToLng(view.lngToX(e.Min.X) - l.Width/tileSize)
		e.Min.Y = view.yToLat(view.latToY(e.Min.Y) + l.Width/tileSize)
		e.Max.X = view.xToLng(view.lngToX(e.Max.X) + l.Width/tileSize)
		e.Max.Y = view.yToLat(view.latToY(e.Max.Y) - l.Width/tileSize)
	}

	return e
}

func (l Line) visit(view viewport, b io.Writer) error {
	if l.Width == 0 {
		l.Width = 6
	}
	if l.Color == "" {
		l.Color = defaultColor
	}
	if l.HaloColor == "" {
		l.HaloColor = defaultHaloColor
	}

	haloColor, err := csscolorparser.Parse(l.HaloColor)
	if err != nil {
		return err
	}

	color, err := csscolorparser.Parse(l.Color)
	if err != nil {
		return err
	}

	path := linePath(view, l.Points)
	if l.HaloWidth > 0 {
		fmt.Fprintf(b, `<path d="%s" stroke="%s" stroke-width="%f" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
			path, html.EscapeString(haloColor.HexString()), l.Width+l.HaloWidth*2)
	}
	fmt.Fprintf(b, `<path d="%s" stroke="%s" stroke-width="%f" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
		path, html.EscapeString(color.HexString()), l.Width)
	return nil
}

func linePath(view viewport, points []geometry.Point) string {
	var b strings.Builder
	for i, p := range points {
		x := view.lngToPixel(p.X)
		y := view.latToPixel(p.Y)

		if i == 0 {
			b.WriteString(fmt.Sprintf("M %d %d ", x, y))
		} else {
			b.WriteString(fmt.Sprintf("L %d %d ", x, y))
		}
	}
	return b.String()
}
