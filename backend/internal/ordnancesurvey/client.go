package ordnancesurvey

import "github.com/dzfranklin/plantopo/backend/internal/phttp"

type Client struct {
	c *phttp.JSONClient
}

func New(userAgent, key string) *Client {
	inner := phttp.NewJSONClient("https://api.os.uk", userAgent)
	inner.SetCommonHeader("key", key)
	return &Client{inner}
}
