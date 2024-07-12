package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIntegratedSecurity(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)
	repo, err := prepo.New(env.Env)
	require.NoError(t, err)
	routes := Routes(env.Env, repo)

	srv := httptest.NewServer(routes)
	t.Cleanup(func() {
		srv.Close()
	})

	cases := []struct {
		name      string
		user      string
		permitted bool
	}{
		{"anonymous", "", false},
		{"non-admin", "u_248h248h248h248h248h248h24", false},
		{"admin", "u_068apfpve5s63510s58136mzb4", true},
	}

	client := http.Client{
		// Never redirect
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req, err := http.NewRequest("GET", srv.URL+"/admin/status", nil)
			require.NoError(t, err)

			if c.user != "" {
				token, err := repo.Sessions.Create(prepo.SessionCreateOptions{UserID: c.user})
				require.NoError(t, err)

				cookie := &http.Cookie{
					Name:  "session",
					Value: token,
				}
				req.AddCookie(cookie)
			}

			res, err := client.Do(req)
			require.NoError(t, err)
			assert.Equal(t, c.permitted, res.StatusCode == http.StatusOK)
		})
	}
}
