package importers

import "github.com/google/uuid"

type Import struct {
	Id    string    `json:"id"`
	MapId uuid.UUID `json:"mapId"`
	// Status is one of "not-started", "in-progress", "complete", "failed"
	Status        string `json:"status"`
	StatusMessage string `json:"statusMessage,omitempty"`
	UploadURL     string `json:"uploadUrl,omitempty"`
}
