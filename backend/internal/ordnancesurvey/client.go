package ordnancesurvey

import "github.com/dzfranklin/plantopo/backend/internal/jsonclient"

type Client struct {
	c *jsonclient.Client
}

func New(userAgent, key string) *Client {
	inner := jsonclient.New("https://api.os.uk", userAgent)
	inner.SetCommonHeader("key", key)
	return &Client{inner}
}
