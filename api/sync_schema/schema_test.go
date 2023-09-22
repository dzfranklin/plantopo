package sync_schema

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMarshalEmpty(t *testing.T) {
	layer := Layer{Id: "lid"}
	got, err := json.Marshal(layer)
	assert.NoError(t, err)
	want := `{"id":"lid"}`
	assert.Equal(t, want, string(got))
}

func TestMarshalPartial(t *testing.T) {
	layer := Layer{Id: "lid", OpacityState: Set, Opacity: 0.5}
	got, err := json.Marshal(layer)
	assert.NoError(t, err)
	want := `{"id":"lid","opacity":0.5}`
	assert.Equal(t, want, string(got))
}

func TestMarshalUnspecified(t *testing.T) {
	layer := Layer{Id: "lid", OpacityState: Unspecified, Opacity: 0.5}
	got, err := json.Marshal(layer)
	assert.NoError(t, err)
	want := `{"id":"lid"}`
	assert.Equal(t, want, string(got))
}

func TestUnmarshalPartial(t *testing.T) {
	data := []byte(`{"id":"lid","opacity":0.5}`)
	var layer Layer
	err := json.Unmarshal(data, &layer)
	assert.NoError(t, err)
	assert.Equal(t, Layer{Id: "lid", OpacityState: Set, Opacity: 0.5}, layer)
}

func TestMarshalUnset(t *testing.T) {
	layer := Layer{Id: "lid", OpacityState: Unset}
	got, err := json.Marshal(layer)
	assert.NoError(t, err)
	want := `{"id":"lid","opacity":null}`
	assert.Equal(t, want, string(got))
}

func TestUnmarshalUnset(t *testing.T) {
	data := []byte(`{"id":"lid","opacity":null}`)
	var layer Layer
	err := json.Unmarshal(data, &layer)
	assert.NoError(t, err)
	assert.Equal(t, Layer{Id: "lid", OpacityState: Unset}, layer)
}

func TestUnmarshalValidates(t *testing.T) {
	data := []byte(`{"id":"lid","opacity":1.5}`)
	err := json.Unmarshal(data, &Layer{})
	assert.Error(t, err)
}
