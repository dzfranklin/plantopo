package pstaticmap

import (
	"math"
)

type viewport struct {
	centerLng float64
	centerLat float64
	width     int
	height    int
	zoom      int
	padding   float64
}

func (v *viewport) fitTo(maybeView *viewport, ops []DrawOp) {
	for z := 17; z >= 0; z-- {
		extent := extentOf(maybeView, ops)
		v.centerLng = extent.Center().X
		v.centerLat = extent.Center().Y
		v.zoom = z

		width := (v.lngToX(extent.Max.X) - v.lngToX(extent.Min.X)) * tileSize
		height := (v.latToY(extent.Min.Y) - v.latToY(extent.Max.Y)) * tileSize
		if width < float64(v.width)-v.padding*2 && height < float64(v.height)-v.padding*2 {
			break
		}
	}
}

func (v *viewport) lngToX(lng float64) float64 {
	if !(-180 <= lng && lng <= 180) {
		lng = math.Remainder(lng+180.0, 360) - 180.0
	}
	return ((lng + 180.0) / 360) * math.Pow(2, float64(v.zoom))
}

func (v *viewport) xToLng(x float64) float64 {
	return x/math.Pow(2, float64(v.zoom))*360 - 180
}

func (v *viewport) centerX() float64 {
	return v.lngToX(v.centerLng)
}

func (v *viewport) latToY(lat float64) float64 {
	if !(-90 <= lat && lat <= 90) {
		lat = math.Remainder(lat+90, 180) - 90
	}
	return (1 - math.Log(math.Tan(lat*math.Pi/180)+1/math.Cos(lat*math.Pi/180))/math.Pi) / 2 * math.Pow(2, float64(v.zoom))
}

func (v *viewport) yToLat(y float64) float64 {
	return math.Atan(math.Sinh(math.Pi*(1-2*y/math.Pow(2, float64(v.zoom))))) / math.Pi * 180
}

func (v *viewport) centerY() float64 {
	return v.latToY(v.centerLat)
}

func (v *viewport) xToPixel(x float64) int {
	px := (x-v.centerX())*tileSize + float64(v.width)/2
	return int(math.Round(px))
}

func (v *viewport) yToPixel(y float64) int {
	px := (y-v.centerY())*tileSize + float64(v.height)/2
	return int(math.Round(px))
}

func (v *viewport) lngToPixel(lng float64) int {
	return v.xToPixel(v.lngToX(lng))
}

func (v *viewport) latToPixel(lat float64) int {
	return v.yToPixel(v.latToY(lat))
}
