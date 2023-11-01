package repo

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
)

type Repo struct {
	client http.Client
}

func New() *Repo {
	return &Repo{}
}

func (r *Repo) GetMapSnapshot(
	ctx context.Context, mapId string,
) (schema.Changeset, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", snapshotUrl(mapId), nil)
	if err != nil {
		return schema.Changeset{}, err
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return schema.Changeset{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return schema.Changeset{}, errors.New("unexpected status code")
	}
	var cset schema.Changeset
	if err := json.NewDecoder(resp.Body).Decode(&cset); err != nil {
		return schema.Changeset{}, err
	}
	return cset, nil
}

func (r *Repo) SetMapSnapshot(
	ctx context.Context, mapId string, value schema.Changeset,
) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", snapshotUrl(mapId), bytes.NewReader(body))
	if err != nil {
		return err
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return errors.New("unexpected status code")
	}
	return nil
}

func snapshotUrl(mapId string) string {
	return "http://internal-api:30001/api/v1/map/" + mapId + "/snapshot"
}
