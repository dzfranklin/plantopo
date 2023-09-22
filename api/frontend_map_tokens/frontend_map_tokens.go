package frontend_map_tokens

import (
	"encoding/json"
	"fmt"
	"os"
)

type Tokens struct {
	Mapbox   string `json:"mapbox"`
	Os       string `json:"os"`
	Maptiler string `json:"maptiler"`
}

func FromOs() (*Tokens, error) {
	raw := os.Getenv("PT_FRONTEND_MAP_TOKENS")
	if raw == "" {
		return nil, fmt.Errorf("missing env var PT_FRONTEND_MAP_TOKENS")
	}

	var out *Tokens
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, fmt.Errorf("failed to unmarshal env var PT_FRONTEND_MAP_TOKENS: %w", err)
	}

	return out, nil
}
