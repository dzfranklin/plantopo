package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/davidbyttow/govips/v2/vips"
	"github.com/tidwall/geojson/geometry"
	"golang.org/x/sync/errgroup"
	"math"
	"sync"
)

// Based on <https://github.com/komoot/staticmap> (Apache 2.0 license)

type Service struct {
	tiles     *tileCache
	drawDebug bool
}

type Opts struct {
	Width  int
	Height int

	Center *geometry.Point
	Zoom   *int

	Fit     bool
	Padding float64

	defaultLine   Line
	defaultCircle Circle

	Draw []DrawOp
}

func (s *Service) DrawWebp(ctx context.Context, opts Opts) ([]byte, error) {
	if opts.Width == 0 || opts.Height == 0 {
		return nil, errors.New("width and height are required")
	}

	view := viewport{
		width:   opts.Width,
		height:  opts.Height,
		padding: opts.Padding,
	}
	if opts.Center != nil {
		view.centerLng = opts.Center.X
		view.centerLat = opts.Center.Y
	}
	if opts.Zoom != nil {
		view.zoom = *opts.Zoom
	}

	if opts.Fit {
		if len(opts.Draw) == 0 {
			return nil, errors.New("must have at least one draw op to use fit")
		}
		view.fitTo(&view, opts.Draw)
	}

	img, drawErr := s.draw(ctx, view, opts.Draw)
	if drawErr != nil {
		return nil, drawErr
	}

	webp, _, exportErr := img.ExportWebp(nil)
	if exportErr != nil {
		return nil, exportErr
	}

	return webp, nil
}

func (s *Service) draw(ctx context.Context, view viewport, ops []DrawOp) (*vips.ImageRef, error) {
	base, baseErr := s.drawBase(ctx, view)
	if baseErr != nil {
		return nil, baseErr
	}

	overlay, overlayErr := s.drawOverlay(view, ops)
	if overlayErr != nil {
		return nil, overlayErr
	}

	if compositeErr := base.Composite(overlay, vips.BlendModeOver, 0, 0); compositeErr != nil {
		return nil, compositeErr
	}

	return base, nil
}

func (s *Service) drawOverlay(view viewport, ops []DrawOp) (*vips.ImageRef, error) {
	contents, drawErr := drawSvg(view, ops)
	if drawErr != nil {
		return nil, drawErr
	}
	return vips.NewImageFromBuffer(contents)
}

func (s *Service) drawBase(ctx context.Context, view viewport) (*vips.ImageRef, error) {
	xMin := int(math.Floor(view.centerX() - (0.5 * float64(view.width) / float64(tileSize))))
	yMin := int(math.Floor(view.centerY() - (0.5 * float64(view.height) / float64(tileSize))))
	xMax := int(math.Ceil(view.centerX() + (0.5 * float64(view.width) / float64(tileSize))))
	yMax := int(math.Ceil(view.centerY() + (0.5 * float64(view.height) / float64(tileSize))))

	var imgMu sync.Mutex

	img, blackErr := vips.Black(view.width, view.height)
	if blackErr != nil {
		return nil, blackErr
	}

	var grp errgroup.Group
	for y := yMin; y < yMax; y++ {
		for x := xMin; x < xMax; x++ {
			// x and y may have crossed the date line
			maxTile := int(math.Pow(2, float64(view.zoom)))
			tileX := (x + maxTile) % maxTile
			tileY := (y + maxTile) % maxTile

			grp.Go(func() error {
				bytes, getErr := s.tiles.Get(ctx, view.zoom, tileX, tileY)
				if getErr != nil {
					return getErr
				}

				value, decodeErr := vips.NewImageFromBuffer(bytes)
				if decodeErr != nil {
					return decodeErr
				}

				if s.drawDebug {
					ink := vips.ColorRGBA{R: 255, G: 0, B: 0, A: 255}
					if err := value.DrawRect(ink, 0, 0, value.Width(), value.Height(), false); err != nil {
						return err
					}
					for _, offsetY := range []float64{0.1, 0.9} {
						for _, offsetX := range []float64{0.1, 0.6} {
							if err := value.Label(&vips.LabelParams{
								Text:      fmt.Sprintf("z=%d x=%d y=%d", view.zoom, tileX, tileY),
								Font:      "Sans",
								Width:     vips.Scalar{Value: 1, Relative: true},
								Height:    vips.Scalar{Value: 10},
								OffsetY:   vips.Scalar{Value: offsetY, Relative: true},
								OffsetX:   vips.Scalar{Value: offsetX, Relative: true},
								Opacity:   1,
								Color:     vips.Color{R: ink.R, G: ink.G, B: ink.B},
								Alignment: vips.AlignCenter,
							}); err != nil {
								return err
							}
						}
					}
				}

				imgMu.Lock()
				compositeErr := img.Composite(
					value,
					vips.BlendModeOver,
					view.xToPixel(float64(x)),
					view.yToPixel(float64(y)),
				)
				imgMu.Unlock()
				if compositeErr != nil {
					return compositeErr
				}

				return nil
			})
		}
	}

	if err := grp.Wait(); err != nil {
		return nil, err
	}

	if s.drawDebug {
		if err := img.DrawRect(vips.ColorRGBA{G: 255, A: 255}, img.Width()/2-2, img.Height()/2-2, 4, 4, true); err != nil {
			return nil, err
		}
	}

	return img, nil
}
