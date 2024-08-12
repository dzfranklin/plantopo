package prepo

import (
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"time"
)

const (
	auditLogIDKind     = "al"
	auditLogCursorKind = "alcur"
)

type AuditLog struct {
	l  *slog.Logger
	db *pgxpool.Pool
}

func newAuditLog(env *pconfig.Env) *AuditLog {
	return &AuditLog{
		l:  env.Logger,
		db: env.DB,
	}
}

func (al *AuditLog) Push(subject, object, action string, payload map[string]any) {
	ctx, cancel := defaultContext()
	defer cancel()

	serializedPayload, err := json.Marshal(payload)
	if err != nil {
		al.l.Error("failed to serialize audit log payload",
			"error", err,
			"subject", subject,
			"object", object,
			"action", action)
		serializedPayload = nil
	}

	err = q.PushAuditLog(ctx, al.db, psqlc.PushAuditLogParams{
		Subject: subject,
		Object:  object,
		Action:  action,
		Payload: serializedPayload,
	})
	if err != nil {
		al.l.Error("failed to push to audit log",
			"error", err,
			"subject", subject,
			"object", object,
			"action", action)
	}
}

type AuditLogEntry struct {
	ID      string
	Time    time.Time
	Subject string
	Object  string
	Action  string
	Payload map[string]any
}

func (al *AuditLog) Get(id string) (AuditLogEntry, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbID, err := IDToSerial(auditLogIDKind, id)
	if err != nil {
		return AuditLogEntry{}, err
	}

	row, err := q.GetAuditLog(ctx, al.db, dbID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AuditLogEntry{}, ErrNotFound
		}
		return AuditLogEntry{}, err
	}

	return mapAuditLog(row)
}

func (al *AuditLog) ListBackwards(subject, object, action *string, cursor *string) ([]AuditLogEntry, string, error) {
	return al.list(subject, object, action, false, cursor)
}

func (al *AuditLog) ListForwards(subject, object, action *string, cursor *string) ([]AuditLogEntry, string, error) {
	return al.list(subject, object, action, true, cursor)
}

func (al *AuditLog) list(
	subject, object, action *string,
	cursorForward bool, cursor *string,
) ([]AuditLogEntry, string, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	var cursorID int64
	if cursor != nil {
		parsed, err := IDToSerial(auditLogCursorKind, *cursor)
		if err != nil {
			return nil, "", ErrInvalidCursor
		}
		cursorID = parsed
	}

	rows, err := q.ListAuditLog(ctx, al.db, psqlc.ListAuditLogParams{
		SubjectSpecified: subject != nil,
		Subject:          stringOrEmpty(subject),
		ObjectSpecified:  object != nil,
		Object:           stringOrEmpty(object),
		ActionSpecified:  action != nil,
		Action:           stringOrEmpty(action),
		CursorForward:    cursor != nil && cursorForward,
		CursorBack:       cursor != nil && !cursorForward,
		Cursor:           cursorID,
	})
	if err != nil {
		return nil, "", err
	}

	var entries []AuditLogEntry
	for _, row := range rows {
		entry, err := mapAuditLog(row)
		if err != nil {
			return nil, "", err
		}
		entries = append(entries, entry)
	}

	var nextCursorID int64
	if len(rows) > 0 {
		if cursorForward {
			nextCursorID = rows[0].ID
		} else {
			nextCursorID = rows[len(rows)-1].ID
		}
	}
	nextCursor := SerialToID(auditLogCursorKind, nextCursorID)

	return entries, nextCursor, err
}

// UpToNow returns a cursor you can use with ListForwards to limit the search to entries
// pushed after UpToNow was called.
func (al *AuditLog) UpToNow() (string, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	val, err := q.SelectMaxAuditLogID(ctx, al.db)
	if err != nil {
		return "", err
	}
	return SerialToID(auditLogCursorKind, val.Int64), nil
}

func mapAuditLog(row psqlc.AuditLog) (AuditLogEntry, error) {
	var payload map[string]any
	err := json.Unmarshal(row.Payload, &payload)
	if err != nil {
		return AuditLogEntry{}, err
	}

	return AuditLogEntry{
		ID:      SerialToID(auditLogIDKind, row.ID),
		Time:    row.Time.Time,
		Subject: row.Subject,
		Object:  row.Object,
		Action:  row.Action,
		Payload: payload,
	}, nil
}
