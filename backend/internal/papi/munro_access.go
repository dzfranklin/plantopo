package papi

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pimg"
	"github.com/dzfranklin/plantopo/backend/internal/pmunroaccess"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"net/http"
	"time"
)

func (h *phandler) MunroAccessRequestPost(_ context.Context, req *MunroAccessRequestPostReq) (*MunroAccessRequestPostOK, error) {
	status, err := h.munroaccess.Request(pmunroaccess.Request{
		FromLabel: req.FromLabel,
		FromPoint: [2]float64(req.FromPoint),
		Date:      req.Date,
	})
	if err != nil {
		return nil, err
	}
	return &MunroAccessRequestPostOK{Status: mapMunroAccessReportStatus(status)}, nil
}

func (h *phandler) MunroAccessReportIDGet(ctx context.Context, params MunroAccessReportIDGetParams) (*MunroAccessReportIDGetTemporaryRedirect, error) {
	url, err := h.munroaccess.GetTemporaryURL(ctx, params.ID)
	if err != nil {
		return nil, err
	}
	return &MunroAccessReportIDGetTemporaryRedirect{Location: NewOptString(url)}, nil
}

func (h *phandler) MunroAccessMunrosGet(_ context.Context) (*MunroAccessMunrosGetOK, error) {
	list, err := h.BritishAndIrishHills.List(prepo.ListBritishAndIrishHillsOpts{
		Classification: "M",
	})
	if err != nil {
		return nil, err
	}

	var features []MunroAccessMunrosGetOKMunrosFeaturesItem
	for _, entry := range list {
		props := MunroAccessMunrosGetOKMunrosFeaturesItemProperties{
			Name:   entry.Name,
			Meters: entry.Metres,
		}

		if len(entry.Photos) > 0 {
			photo := entry.Photos[0]

			width := 333
			height := 250

			src := h.img.Source(photo.Source).
				Width(width).Height(height).ResizingType(pimg.ResizeFill).Dpr(2).Build("jpg")

			props.Photo = NewOptMunroAccessMunrosGetOKMunrosFeaturesItemPropertiesPhoto(MunroAccessMunrosGetOKMunrosFeaturesItemPropertiesPhoto{
				Source:     src,
				Width:      width,
				Height:     height,
				Author:     NewOptString(photo.Author),
				SourceText: NewOptString(photo.SourceText),
				SourceLink: NewOptString(photo.SourceLink),
			})
		}

		features = append(features, MunroAccessMunrosGetOKMunrosFeaturesItem{
			Type:       "Feature",
			ID:         int(entry.ID),
			Properties: props,
			Geometry: MunroAccessMunrosGetOKMunrosFeaturesItemGeometry{
				Type:        "Point",
				Coordinates: []float64{entry.Lng, entry.Lat},
			},
		})
	}
	return &MunroAccessMunrosGetOK{
		Munros: MunroAccessMunrosGetOKMunros{
			Type:     "FeatureCollection",
			Features: features,
		},
	}, nil
}

func (h *phandler) MunroAccessReportIDStatusGet(ctx context.Context, params MunroAccessReportIDStatusGetParams) (*MunroAccessReportStatus, error) {
	status, err := h.munroaccess.Status(ctx, params.ID)
	if errors.Is(err, pmunroaccess.ErrReportNotFound) {
		return nil, &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusNotFound,
			Response: DefaultError{
				Message: "report not found",
			},
		}
	} else if err != nil {
		return nil, err
	}
	out := mapMunroAccessReportStatus(status)
	return &out, nil
}

func (h *phandler) MunroAccessReportIDStatusUpdatesGet(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)

	id := r.PathValue("id")
	if id == "" {
		panic("missing path value")
	}

	updates, err := h.munroaccess.WatchStatus(r.Context(), id)
	if errors.Is(err, pmunroaccess.ErrReportNotFound) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"message": "report not found"}`))
		return
	} else if err != nil {
		h.Logger.Error("watch status", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)

	ticker := time.NewTicker(time.Second * 30)
	defer ticker.Stop()

	for {
		select {
		case update := <-updates:
			toMarshal := mapMunroAccessReportStatus(update)
			updateJSON, err := toMarshal.MarshalJSON()
			if err != nil {
				h.Logger.Error("marshal json", "error", err)
				return
			}
			if _, err := fmt.Fprintf(w, "id: %s\nevent: status\ndata: %s\n\n", update.ID, updateJSON); err != nil {
				return
			}
		case <-ticker.C:
			if _, err := fmt.Fprintln(w, ":keepalive"); err != nil {
				return
			}
		}

		if err := rc.Flush(); err != nil {
			return
		}
	}
}

func (h *phandler) MunroAccessPregeneratedReportsGet(ctx context.Context) (*MunroAccessPregeneratedReportsGetOK, error) {
	reports, err := h.munroaccess.PregeneratedReports(ctx)
	if err != nil {
		return nil, err
	}
	return &MunroAccessPregeneratedReportsGetOK{
		Reports: pslices.Map(reports, mapMunroAccessReportMeta),
	}, nil
}

func mapMunroAccessReportStatus(status pmunroaccess.Status) MunroAccessReportStatus {
	return MunroAccessReportStatus{
		ID:        status.ID,
		Timestamp: status.Timestamp,
		Status:    MunroAccessReportStatusStatus(status.Status),
		Report:    mapMunroAccessReportMeta(status.Report),
	}
}

func mapMunroAccessReportMeta(meta pmunroaccess.Meta) MunroAccessReportMeta {
	return MunroAccessReportMeta{
		ID:          meta.ID,
		Slug:        meta.Slug,
		FromLabel:   meta.FromLabel,
		FromPoint:   NewPoint(meta.FromPoint),
		Date:        meta.Date,
		RequestTime: meta.RequestTime,
		URL:         omitEmptyString(meta.URL),
	}
}
