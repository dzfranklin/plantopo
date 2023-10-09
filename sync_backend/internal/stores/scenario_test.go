package stores

import (
	"embed"
	"testing"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
	"sigs.k8s.io/yaml"
)

type scenarioModel struct {
	name  string
	Given *schema.Changeset `json:"GIVEN"`
	When  *schema.Changeset `json:"WHEN"`
	Then  thenModel         `json:"THEN"`
}

type thenModel struct {
	Snapshot *schema.Changeset `json:"SNAPSHOT"`
	Fixes    *schema.Changeset `json:"FIXES"`
	Error    *string           `json:"ERROR"`
}

func TestScenarios(t *testing.T) {
	scenarios := getScenarios(t)
	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			runScenario(t, s)
		})
	}
}

func TestScenario(t *testing.T) {
	name := "null_collision_bug.yaml"
	scenario := getScenario(t, name)
	runScenario(t, scenario)
}

func runScenario(t *testing.T, s scenarioModel) {
	l := zaptest.NewLogger(t)

	subject, err := New("map", *s.Given)
	require.NoError(t, err, "failed to load GIVEN")

	fixes, err := subject.Update(l, s.When)

	if s.Then.Error != nil {
		require.Error(t, err)
		require.Contains(t, err.Error(), *s.Then.Error)
	} else {
		require.NoError(t, err, "failed to apply WHEN")

		require.Equal(t, toYAML(s.Then.Snapshot), toYAML(subject.Snapshot()), "snapshot mismatch")

		require.Equal(t, toYAML(s.Then.Fixes), toYAML(fixes), "fixes mismatch")
	}
}

func toYAML(v interface{}) string {
	b, err := yaml.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}

//go:embed scenario_tests/*.yaml
var fs embed.FS

func getScenarios(t *testing.T) []scenarioModel {
	t.Helper()
	dir, err := fs.ReadDir("scenario_tests")
	require.NoError(t, err)
	out := make([]scenarioModel, 0, len(dir))
	for _, f := range dir {
		out = append(out, getScenario(t, f.Name()))
	}
	return out
}

func getScenario(t *testing.T, name string) scenarioModel {
	t.Helper()
	b, err := fs.ReadFile("scenario_tests/" + name)
	require.NoError(t, err)
	var out scenarioModel
	require.NoError(t, yaml.Unmarshal(b, &out))
	out.name = name
	return out
}
