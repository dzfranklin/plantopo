package frontend_map_tokens

import (
	"encoding/json"
	"go.uber.org/zap"
)

type Tokens struct {
	Mapbox   string `json:"mapbox"`
	Os       string `json:"os"`
	Maptiler string `json:"maptiler"`
}

func MustFromRaw(raw string) *Tokens {
	var out *Tokens
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		zap.S().Panicw("failed to unmarshal frontend map tokens: %w", err)
	}
	return out
}
