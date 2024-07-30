package papi

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/dzfranklin/plantopo/backend/internal/pweather"
	"net/http"
	"strings"
)

func (h *phandler) WeatherShortUkGet(ctx context.Context, params WeatherShortUkGetParams) (WeatherShortUkGetOK, error) {
	msg, err := h.weather.FindUKShortForecast(ctx, params.Query)
	if err != nil {
		if errors.Is(err, pweather.ErrNotFound) {
			return WeatherShortUkGetOK{}, &DefaultErrorResponseStatusCode{
				StatusCode: http.StatusNotFound,
				Response:   DefaultError{Message: "not found"},
			}
		} else if errInfo, ok := perrors.Into[pweather.ErrAmbiguousPlaceName](err); ok {
			return WeatherShortUkGetOK{}, &DefaultErrorResponseStatusCode{
				StatusCode: http.StatusBadRequest,
				Response:   DefaultError{Message: errInfo.Error()},
			}
		} else {
			return WeatherShortUkGetOK{}, err
		}
	}

	return WeatherShortUkGetOK{strings.NewReader(msg)}, nil
}
