// Code generated by ogen, DO NOT EDIT.

package papi

import (
	"net/http"

	"github.com/ogen-go/ogen/conv"
	"github.com/ogen-go/ogen/middleware"
	"github.com/ogen-go/ogen/ogenerrors"
	"github.com/ogen-go/ogen/uri"
	"github.com/ogen-go/ogen/validate"
)

// WeatherShortUkGetParams is parameters of GET /weather/short-uk operation.
type WeatherShortUkGetParams struct {
	// A place to search for.
	Query string
}

func unpackWeatherShortUkGetParams(packed middleware.Parameters) (params WeatherShortUkGetParams) {
	{
		key := middleware.ParameterKey{
			Name: "query",
			In:   "query",
		}
		params.Query = packed[key].(string)
	}
	return params
}

func decodeWeatherShortUkGetParams(args [0]string, argsEscaped bool, r *http.Request) (params WeatherShortUkGetParams, _ error) {
	q := uri.NewQueryDecoder(r.URL.Query())
	// Decode query: query.
	if err := func() error {
		cfg := uri.QueryParameterDecodingConfig{
			Name:    "query",
			Style:   uri.QueryStyleForm,
			Explode: true,
		}

		if err := q.HasParam(cfg); err == nil {
			if err := q.DecodeParam(cfg, func(d uri.Decoder) error {
				val, err := d.DecodeValue()
				if err != nil {
					return err
				}

				c, err := conv.ToString(val)
				if err != nil {
					return err
				}

				params.Query = c
				return nil
			}); err != nil {
				return err
			}
		} else {
			return validate.ErrFieldRequired
		}
		return nil
	}(); err != nil {
		return params, &ogenerrors.DecodeParamError{
			Name: "query",
			In:   "query",
			Err:  err,
		}
	}
	return params, nil
}