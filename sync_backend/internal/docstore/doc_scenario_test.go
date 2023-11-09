package docstore

import (
	"bytes"
	"embed"
	"fmt"
	"math/rand"
	"testing"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
	"sigs.k8s.io/yaml"
)

type scenarioModel struct {
	name  string
	Given *schema.Changeset `json:"Given"`
	When  *schema.Changeset `json:"When"`
	Then  *schema.Changeset `json:"Then"`
	Error *string           `json:"ThenError"`
}

func TestScenarios(t *testing.T) {
	scenarios := getScenarios(t)
	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			runScenario(t, s)
		})
	}
}

func runScenario(t *testing.T, s scenarioModel) {
	l := zaptest.NewLogger(t)

	subject := newDocState(l, 0)
	subject.rng = rand.New(rand.NewSource(0xdeadbeef))
	subject.stableFindFeatureChanges = true

	if s.Given != nil {
		_, err := subject.Update(s.Given)
		require.NoError(t, err, "failed to load GIVEN")
	}

	_, err := subject.Update(s.When)
	if s.Error == nil {
		require.NoError(t, err, "unexpected error")
	} else {
		require.Error(t, err)
		require.Contains(t, err.Error(), *s.Error)
	}

	if s.Then != nil {
		_, snapshot := subject.ChangesAfter(0)
		if snapshot == nil {
			require.Nil(t, s.Then)
		} else {
			require.Equal(t, changesetToYaml(s.Then), changesetToYaml(snapshot), "snapshot mismatch")
		}
	}
}

func changesetToYaml(v *schema.Changeset) string {
	jsonB, err := v.MarshalJSONStable()
	if err != nil {
		panic(err)
	}

	b, err := yaml.JSONToYAML(jsonB)
	if err != nil {
		panic(err)
	}
	return string(b)
}

//go:embed doc_scenario_tests/*.yaml
var fs embed.FS

func getScenarios(t *testing.T) []scenarioModel {
	t.Helper()
	dir, err := fs.ReadDir("doc_scenario_tests")
	require.NoError(t, err)
	out := make([]scenarioModel, 0, len(dir))
	for _, f := range dir {
		out = append(out, getScenariosFromFile(t, f.Name())...)
	}
	return out
}

func getScenariosFromFile(t *testing.T, name string) []scenarioModel {
	t.Helper()
	path := "doc_scenario_tests/" + name
	b, err := fs.ReadFile(path)
	require.NoError(t, err)

	var sources [][]byte
	lines := bytes.Split(b, []byte("\n"))
	start := 0
	for i, line := range lines {
		if bytes.Equal(bytes.TrimSpace(line), []byte("---")) {
			sources = append(sources, bytes.Join(lines[start:i], []byte("\n")))
			start = i + 1
		}
	}
	sources = append(sources, bytes.Join(lines[start:], []byte("\n")))

	var scenarios []scenarioModel
	for _, s := range sources {
		var out scenarioModel
		err = yaml.Unmarshal(s, &out)
		if err != nil {
			panic(fmt.Errorf("unmarshal %s: %w", path, err))
		}
		scenarios = append(scenarios, out)
	}

	for i := range scenarios {
		if len(scenarios) == 1 {
			scenarios[i].name = name
		} else {
			scenarios[i].name = fmt.Sprintf("%s/%d", name, i)
		}
	}

	return scenarios
}
