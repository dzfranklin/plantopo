package importers

type Import struct {
	Id    string `json:"id"`
	MapId string `json:"mapId"`
	// Status is one of "not-started", "in-progress", "complete", "failed"
	Status        string `json:"status"`
	StatusMessage string `json:"statusMessage,omitempty"`
	UploadURL     string `json:"uploadURL,omitempty"`
}
