package main

type mountainPhoto struct {
	ID         int32    `json:"id,omitempty"`
	Name       string   `json:"name,omitempty"`
	File       string   `json:"file,omitempty"`
	Caption    string   `json:"caption,omitempty"`
	Licenses   []string `json:"licenses,omitempty"`
	Size       int      `json:"size,omitempty"`
	Width      int      `json:"width,omitempty"`
	Height     int      `json:"height,omitempty"`
	UploadDate string   `json:"uploadDate,omitempty"`
	Author     string   `json:"author,omitempty"`
	Source     string   `json:"source,omitempty"`
	SourceLink string   `json:"sourceLink,omitempty"`
}
