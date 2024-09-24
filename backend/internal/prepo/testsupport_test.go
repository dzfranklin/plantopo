package prepo

import (
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"os"
	"os/exec"
	"path"
	"reflect"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func markAuditLog(t *testing.T, al *AuditLog) string {
	t.Helper()
	mark, err := al.UpToNow()
	require.NoError(t, err)
	return mark
}

func assertAudit(t *testing.T, al *AuditLog, mark string, expected AuditLogEntry) {
	t.Helper()
	page, _, err := al.ListForwards(nil, nil, nil, &mark)
	require.NoError(t, err)
	if len(page) == 0 {
		t.Fatal("expected audit log entry")
	} else if len(page) > 1 {
		t.Fatalf("expected only on audit log entry, got at least %d", len(page))
	}

	entry := page[0]
	clearIrrelevantAuditLogFields(&entry)

	assert.Equal(t, expected, entry)
}

func clearIrrelevantAuditLogFields(entry *AuditLogEntry) {
	entry.ID = ""
	entry.Time = time.Time{}
}

func assertFieldErrors(t *testing.T, err error, expected map[string]string) {
	assert.NotNil(t, err)
	errValidation, ok := perrors.Into[*ErrValidation](err)
	assert.Truef(t, ok, "should be an ErrValidation, got: %+v", err)
	assert.Equal(t, expected, errValidation.FieldErrors)
}

func assertMVT(t *testing.T, tile []byte, name string, features []map[string]any) {
	t.Helper()

	if len(tile) == 0 {
		assert.NotEmpty(t, tile)
		return
	}

	tileJSON := testMVTToJSON(tile)
	var tileData struct {
		Name     string `json:"name"`
		Features []struct {
			Properties map[string]any `json:"properties"`
		} `json:"features"`
	}
	if err := json.Unmarshal([]byte(tileJSON), &tileData); err != nil {
		panic(err)
	}

	assert.Equal(t, name, tileData.Name)

	got := make([]map[string]any, 0)
	for _, f := range tileData.Features {
		got = append(got, f.Properties)
	}

	hasIssue := false

	propsEqual := func(a, b map[string]any) bool {
		if len(a) != len(b) {
			return false
		}
		for k, va := range a {
			vb, bHas := b[k]
			if !bHas {
				return false
			}

			aInt, aIsInt := va.(int)
			bInt, bIsInt := vb.(int)
			if aIsInt {
				va = float64(aInt)
			}
			if bIsInt {
				vb = float64(bInt)
			}

			if !reflect.DeepEqual(va, vb) {
				return false
			}
		}
		return true
	}

	for _, expectedEl := range features {
		found := false
		for _, gotEl := range got {
			if propsEqual(expectedEl, gotEl) {
				found = true
				break
			}
		}

		if !found {
			hasIssue = true
			item, itemErr := json.Marshal(expectedEl)
			if itemErr != nil {
				panic(itemErr)
			}
			t.Errorf("expected: %s", item)
		}
	}

	for _, gotEl := range got {
		found := false
		for _, expectedEl := range features {
			if propsEqual(gotEl, expectedEl) {
				found = true
				break
			}
		}

		if !found {
			hasIssue = true
			item, itemErr := json.Marshal(gotEl)
			if itemErr != nil {
				panic(itemErr)
			}
			t.Errorf("unexpected: %s", item)
		}
	}

	if hasIssue {
		var gotMsg strings.Builder
		gotMsg.WriteString("got features:\n")
		for _, f := range got {
			item, itemErr := json.Marshal(f)
			if itemErr != nil {
				panic(itemErr)
			}
			gotMsg.Write(item)
			gotMsg.WriteRune('\n')
		}
		t.Log(gotMsg.String())
	}
}

func testMVTToJSON(tile []byte) string {
	tmpDir, tmpDirErr := os.MkdirTemp("", "")
	if tmpDirErr != nil {
		panic(tmpDirErr)
	}
	defer func() {
		if err := os.RemoveAll(tmpDir); err != nil {
			panic(err)
		}
	}()

	inPath := path.Join(tmpDir, "input.mvt")
	if err := os.WriteFile(inPath, tile, 0666); err != nil {
		panic(err)
	}

	outPath := path.Join("output.json")

	output, runErr := exec.Command("ogr2ogr", "-f", "geojson", outPath, inPath).CombinedOutput()
	if runErr != nil {
		fmt.Println(string(output))
		panic(runErr)
	}

	out, readOutErr := os.ReadFile(outPath)
	if readOutErr != nil {
		panic(readOutErr)
	}

	if !utf8.Valid(out) {
		panic("invalid utf8")
	}
	return string(out)
}
