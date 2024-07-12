package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
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

func assertAudits(t *testing.T, al *AuditLog, mark string, expected []AuditLogEntry) {
	t.Helper()
	actual := auditsSince(al, mark)
	assert.Equal(t, expected, actual)
}

func auditsSince(al *AuditLog, mark string) []AuditLogEntry {
	var out []AuditLogEntry
	cursor := mark
	for {
		page, nextCursor, err := al.ListForwards(nil, nil, nil, &cursor)
		if err != nil {
			panic(err)
		}

		for _, entry := range page {
			clearIrrelevantAuditLogFields(&entry)
			out = append(out, entry)
		}

		cursor = nextCursor

		if len(page) == 0 {
			break
		}
	}
	return out
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
