// Code generated by ogen, DO NOT EDIT.

package papi

import (
	"io"
	"net/http"

	"github.com/go-faster/errors"
	"github.com/go-faster/jx"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/ogen-go/ogen/conv"
	ht "github.com/ogen-go/ogen/http"
	"github.com/ogen-go/ogen/uri"
)

func encodeAuthAuthenticateBrowserPostResponse(response *AuthenticateBrowserOKHeaders, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Encoding response headers.
	{
		h := uri.NewHeaderEncoder(w.Header())
		// Encode "Set-Cookie" header.
		{
			cfg := uri.HeaderParameterEncodingConfig{
				Name:    "Set-Cookie",
				Explode: false,
			}
			if err := h.EncodeParam(cfg, func(e uri.Encoder) error {
				if val, ok := response.SetCookie.Get(); ok {
					if unwrapped := string(val); true {
						return e.EncodeValue(conv.StringToString(unwrapped))
					}
					return nil
				}
				return nil
			}); err != nil {
				return errors.Wrap(err, "encode Set-Cookie header")
			}
		}
	}
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeAuthAuthenticatePostResponse(response *AuthenticateOK, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeAuthCheckPostResponse(response *AuthCheckPostOK, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeAuthRegisterBrowserPostResponse(response *AuthenticateBrowserOKHeaders, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Encoding response headers.
	{
		h := uri.NewHeaderEncoder(w.Header())
		// Encode "Set-Cookie" header.
		{
			cfg := uri.HeaderParameterEncodingConfig{
				Name:    "Set-Cookie",
				Explode: false,
			}
			if err := h.EncodeParam(cfg, func(e uri.Encoder) error {
				if val, ok := response.SetCookie.Get(); ok {
					if unwrapped := string(val); true {
						return e.EncodeValue(conv.StringToString(unwrapped))
					}
					return nil
				}
				return nil
			}); err != nil {
				return errors.Wrap(err, "encode Set-Cookie header")
			}
		}
	}
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeAuthRegisterPostResponse(response *AuthenticateOK, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeAuthRevokeBrowserPostResponse(response *AuthRevokeBrowserPostOKHeaders, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Encoding response headers.
	{
		h := uri.NewHeaderEncoder(w.Header())
		// Encode "Set-Cookie" header.
		{
			cfg := uri.HeaderParameterEncodingConfig{
				Name:    "Set-Cookie",
				Explode: false,
			}
			if err := h.EncodeParam(cfg, func(e uri.Encoder) error {
				if val, ok := response.SetCookie.Get(); ok {
					return e.EncodeValue(conv.StringToString(val))
				}
				return nil
			}); err != nil {
				return errors.Wrap(err, "encode Set-Cookie header")
			}
		}
	}
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeAuthRevokePostResponse(response *AuthRevokePostOK, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeElevationPostResponse(response *ElevationPostOK, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	e := new(jx.Encoder)
	response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeWeatherShortUkGetResponse(response WeatherShortUkGetOK, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(200)
	span.SetStatus(codes.Ok, http.StatusText(200))

	writer := w
	if _, err := io.Copy(writer, response); err != nil {
		return errors.Wrap(err, "write")
	}

	return nil
}

func encodeErrorResponse(response *DefaultErrorResponseStatusCode, w http.ResponseWriter, span trace.Span) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	code := response.StatusCode
	if code == 0 {
		// Set default status code.
		code = http.StatusOK
	}
	w.WriteHeader(code)
	if st := http.StatusText(code); code >= http.StatusBadRequest {
		span.SetStatus(codes.Error, st)
	} else {
		span.SetStatus(codes.Ok, st)
	}

	e := new(jx.Encoder)
	response.Response.Encode(e)
	if _, err := e.WriteTo(w); err != nil {
		return errors.Wrap(err, "write")
	}

	if code >= http.StatusInternalServerError {
		return errors.Wrapf(ht.ErrInternalServerErrorResponse, "code: %d, message: %s", code, http.StatusText(code))
	}
	return nil

}