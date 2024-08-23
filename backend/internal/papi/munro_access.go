package papi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pimg"
	"github.com/dzfranklin/plantopo/backend/internal/pmunroaccess"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

func (h *phandler) MunroAccessRequestPost(ctx context.Context, req *MunroAccessRequestPostReq) (*MunroAccessRequestPostOK, error) {
	id, err := h.munroaccess.Request(pmunroaccess.Request{
		FromLabel: req.FromLabel,
		FromPoint: [2]float64(req.FromPoint),
		Date:      req.Date,
	})
	if err != nil {
		return nil, err
	}
	return &MunroAccessRequestPostOK{ID: id}, nil
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

func (h *phandler) MunroAccessReportIDStatusGet(ctx context.Context, params MunroAccessReportIDStatusGetParams) (*MunroAccessReportIDStatusGetOK, error) {
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
	return &MunroAccessReportIDStatusGetOK{
		ID:        status.ID,
		Timestamp: status.Timestamp,
		Status:    MunroAccessReportIDStatusGetOKStatus(status.Status),
		Report: MunroAccessReportIDStatusGetOKReport{
			FromLabel:   status.Report.FromLabel,
			FromPoint:   NewPoint(status.Report.FromPoint),
			Date:        status.Report.Date,
			RequestTime: status.Report.RequestTime,
			URL:         omitEmptyString(status.Report.URL),
		},
	}, nil
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

	for update := range updates {
		updateJSON, err := json.Marshal(update)
		if err != nil {
			h.Logger.Error("marshal json", "error", err)
			return
		}

		if _, err := fmt.Fprintf(w, "event: status\ndata: %s\n\n", updateJSON); err != nil {
			return
		}
		if err := rc.Flush(); err != nil {
			return
		}
	}
}
