package prepo

import (
	"github.com/google/uuid"
	"math"
	"testing"
)

func TestSerialID(t *testing.T) {
	t.Parallel()
	cases := []struct {
		serial int64
		id     string
	}{
		{0, "kind_0000000000000"},
		{42, "kind_000000000002m"},
		{math.MaxInt64, "kind_fzzzzzzzzzzzy"},
	}
	kind := "kind"
	for _, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			roundTripped, err := IDToSerial(kind, SerialToID(kind, c.serial))
			if err != nil {
				t.Fatal(err)
			}
			if roundTripped != c.serial {
				t.Error("failed to round-trip", "original", c.serial, "roundTripped", roundTripped)
			}

			toID := SerialToID(kind, c.serial)
			if toID != c.id {
				t.Error("SerialToID doesn't match", "got", toID, "expected", c.id)
			}

			toSerial, err := IDToSerial(kind, c.id)
			if err != nil {
				t.Fatal(err)
			}
			if toSerial != c.serial {
				t.Error("IDToSerial doesn't match", "got", toSerial, "expected", c.serial)
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
