package phttp

import (
	"context"
	"github.com/stretchr/testify/require"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientPassesUA(t *testing.T) {
	c := New(&Options{UserAgent: "test-ua"})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(r.Header.Get("User-Agent")))
	}))
	t.Cleanup(func() { srv.Close() })

	resp, err := c.Get(context.Background(), srv.URL)
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	require.Equal(t, "test-ua", string(body))
}

func TestClientUsesContext(t *testing.T) {
	c := New(nil)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	t.Cleanup(func() { srv.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := c.Get(ctx, srv.URL)
	require.ErrorIs(t, err, context.Canceled)
}

func TestClientSaveCookies(t *testing.T) {
	c := New(&Options{SaveCookies: true})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		val, err := r.Cookie("cookie")
		if err == nil {
			_, _ = w.Write([]byte(val.Value))
		} else {
			http.SetCookie(w, &http.Cookie{
				Name:   "cookie",
				Value:  "set",
				MaxAge: 1000,
			})
			w.WriteHeader(200)
		}
	}))
	t.Cleanup(func() { srv.Close() })

	resp, err := c.Get(context.Background(), srv.URL)
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Empty(t, body)

	resp, err = c.Get(context.Background(), srv.URL)
	require.NoError(t, err)
	body, err = io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, "set", string(body))
}
