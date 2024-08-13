package ordnancesurvey

import "github.com/dzfranklin/plantopo/backend/internal/phttp"

type Client struct {
	c *phttp.JSONClient
}

func New(key string) *Client {
	inner := phttp.NewJSONClient("https://api.os.uk")
	inner.SetCommonHeader("key", key)
	return &Client{inner}
}
