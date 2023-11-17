package internal_test

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/converter"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/doclog"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/docstore"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
	"io"
	"net/http"
	"os"
	"path"
	"testing"
)

const samplesHost = "https://pt-samples.dfusercontent.com"

func TestConvertLarge(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}
	f := openSample(t, "at_centerline_full.gpx")
	defer f.Close()

	_, err := converter.ConvertToChangeset(zaptest.NewLogger(t), "gpx", "testid", "at_centerline_full.gpx", f)
	require.NoError(t, err)
}

func TestUpdateLarge(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}
	l := zaptest.NewLogger(t)
	f := openSample(t, "at_centerline_full.ptinternal")
	defer f.Close()
	var cset sync_schema.Changeset
	if err := json.NewDecoder(f).Decode(&cset); err != nil {
		t.Fatal(err)
	}

	subject := docstore.New("map1", docstore.Config{
		Logger: l,
		Loader: func(ctx context.Context, mapId string) (docstore.DocLogger, error) {
			return &memLog{}, nil
		},
	})
	require.NoError(t, subject.WaitForReady())

	err := subject.Update(&cset)
	require.NoError(t, err)
}

type memLog struct {
	entries []*doclog.Entry
}

func (m *memLog) Get() []*doclog.Entry {
	return m.entries
}

func (m *memLog) Len() int {
	return len(m.entries)
}

func (m *memLog) Push(_ context.Context, entry *doclog.Entry) error {
	m.entries = append(m.entries, entry)
	return nil
}

func (m *memLog) Replace(_ context.Context, entry *doclog.Entry) error {
	m.entries = []*doclog.Entry{entry}
	return nil
}

func openSample(t *testing.T, name string) *os.File {
	t.Helper()

	dir := path.Join(os.TempDir(), "pt_test_samples")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}

	fname := path.Join(dir, name)
	f, err := os.Open(fname)
	if err != nil {
		url := fmt.Sprintf("%s/%s", samplesHost, name)
		fmt.Printf("downloading %s\n", url)
		r, err := http.Get(url)
		if err != nil {
			t.Fatal(err)
		}
		defer r.Body.Close()
		f, err = os.Create(fname)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.Copy(f, r.Body); err != nil {
			t.Fatal(err)
		}
		if _, err := f.Seek(0, 0); err != nil {
			t.Fatal(err)
		}
	}
	fmt.Printf("using %s\n", fname)

	return f
}
