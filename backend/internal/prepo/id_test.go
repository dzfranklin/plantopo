package prepo

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"math"
	"testing"
	"testing/quick"
)

func TestSerialID(t *testing.T) {
	t.Parallel()
	cases := []struct {
		serial int64
		id     string
	}{
		{0, "kind_0"},
		{42, "kind_42"},
		{math.MaxInt64, "kind_9223372036854775807"},
	}
	kind := "kind"
	for _, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			roundTripped, err := IDToInt(kind, IntToID(kind, c.serial))
			if err != nil {
				t.Fatal(err)
			}
			if roundTripped != c.serial {
				t.Error("failed to round-trip", "original", c.serial, "roundTripped", roundTripped)
			}

			toID := IntToID(kind, c.serial)
			if toID != c.id {
				t.Error("IntToID doesn't match", "got", toID, "expected", c.id)
			}

			toSerial, err := IDToInt(kind, c.id)
			if err != nil {
				t.Fatal(err)
			}
			if toSerial != c.serial {
				t.Error("IDToInt doesn't match", "got", toSerial, "expected", c.serial)
			}
		})
	}
}

func TestUUIDID(t *testing.T) {
	t.Parallel()
	cases := []struct {
		uuid uuid.UUID
		id   string
	}{
		{uuid.Nil, "kind_00000000000000000000000000"},
		{uuid.MustParse("0190a7e4-f9cb-7dcf-8f57-09051c531552"), "kind_068afs7ssdywz3tq142hrmrna8"},
		{uuid.MustParse("0190a7e5-2c49-708d-9b52-f20ba517801b"), "kind_068afs9c95r8v6tjy85ta5w03c"},
	}
	kind := "kind"
	for _, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			roundTripped, err := IDToUUID(kind, UUIDToID(kind, c.uuid))
			if err != nil {
				t.Fatal(err)
			}
			if roundTripped != c.uuid {
				t.Error("failed to round-trip", "original", c.uuid, "roundTripped", roundTripped)
			}

			toID := UUIDToID(kind, c.uuid)
			if toID != c.id {
				t.Error("UUIDToID doesn't match", "got", toID, "expected", c.id)
			}

			toSerial, err := IDToUUID(kind, c.id)
			if err != nil {
				t.Fatal(err)
			}
			if toSerial != c.uuid {
				t.Error("IDToUUID doesn't match", "got", toSerial, "expected", c.uuid)
			}
		})
	}
}

func TestDBMultiCharKind(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)
	db := env.DB

	cases := []string{
		"uuid_to_id('kind', '11111111-1111-1111-1111-111111111111') = 'kind_248h248h248h248h248h248h24'",
		"id_to_uuid('kind', 'kind_248h248h248h248h248h248h24') = '11111111-1111-1111-1111-111111111111'",
		"int_to_id('kind', 1) = 'kind_1'",
		"id_to_int('kind', 'kind_1') = 1",
	}
	for _, stmt := range cases {
		t.Run(stmt, func(t *testing.T) {
			var res bool
			gotErr := db.QueryRow(context.Background(), "SELECT "+stmt).Scan(&res)
			require.NoError(t, gotErr)
			assert.True(t, res)
		})
	}
}

func TestDBUUIDToID(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)
	db := env.DB

	doCheck := func(v uuid.UUID) bool {
		expected := UUIDToID("t", v)
		var got string
		gotErr := db.QueryRow(context.Background(), "SELECT uuid_to_id('t', $1)", v).Scan(&got)
		if gotErr != nil {
			panic(gotErr)
		}
		return got == expected
	}

	assert.True(t, doCheck(uuid.UUID{}))
	assert.True(t, doCheck(uuid.MustParse("11111111-1111-1111-1111-111111111111")))
	assert.True(t, doCheck(uuid.MustParse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")))

	assert.NoError(t, quick.Check(doCheck, &quick.Config{MaxCount: 5_000}))
}

func TestDBIntToID(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)
	db := env.DB

	doCheck := func(v int64) bool {
		expected := IntToID("t", v)
		var got string
		gotErr := db.QueryRow(context.Background(), "SELECT int_to_id('t', $1)", v).Scan(&got)
		if gotErr != nil {
			panic(gotErr)
		}
		return got == expected
	}

	assert.True(t, doCheck(0))
	assert.True(t, doCheck(1))
	assert.True(t, doCheck(math.MaxInt64))

	assert.NoError(t, quick.Check(doCheck, &quick.Config{MaxCount: 5_000}))
}

func TestDBIDToUUID(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)
	db := env.DB

	doCheck := func(expected uuid.UUID) bool {
		input := UUIDToID("t", expected)

		var got uuid.UUID
		gotErr := db.QueryRow(context.Background(), "SELECT id_to_uuid('t', $1)", input).Scan(&got)
		if gotErr != nil {
			panic(gotErr)
		}
		return got == expected
	}

	assert.True(t, doCheck(uuid.UUID{}))
	assert.True(t, doCheck(uuid.MustParse("11111111-1111-1111-1111-111111111111")))
	assert.True(t, doCheck(uuid.MustParse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")))

	assert.NoError(t, quick.Check(doCheck, &quick.Config{MaxCount: 5_000}))
}
