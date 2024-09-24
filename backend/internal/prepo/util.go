package prepo

import (
	"context"
	"encoding/base32"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"time"
)

type M map[string]any
type SM map[string]string

var (
	q = psqlc.New()
	// Crockford's alphabet
	idEncoding = base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz").WithPadding(base32.NoPadding)
)

func pgBool(v bool) pgtype.Bool {
	return pgtype.Bool{Bool: v, Valid: true}
}

func pgOptInt4(v int) pgtype.Int4 {
	if v == 0 {
		return pgtype.Int4{}
	} else {
		return pgtype.Int4{Int32: int32(v), Valid: true}
	}
}

func pgText(v string) pgtype.Text {
	return pgtype.Text{
		String: v,
		Valid:  true,
	}
}

func pgOptText(v string) pgtype.Text {
	if v == "" {
		return pgtype.Text{}
	} else {
		return pgtype.Text{
			String: v,
			Valid:  true,
		}
	}
}

func pgOptTimestamp(v time.Time) pgtype.Timestamp {
	if v.IsZero() {
		return pgtype.Timestamp{}
	} else {
		return pgtype.Timestamp{Valid: true, Time: v}
	}
}

func pgOptTimestamptz(v time.Time) pgtype.Timestamptz {
	if v.IsZero() {
		return pgtype.Timestamptz{}
	} else {
		return pgtype.Timestamptz{Valid: true, Time: v}
	}
}

func pgTimestamptz(v time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Valid: true, Time: v}
}

func pgTextUnlessEmpty(v string) pgtype.Text {
	if v == "" {
		return pgtype.Text{}
	} else {
		return pgtype.Text{
			String: v,
			Valid:  true,
		}
	}
}

func pgUUID(v uuid.UUID) pgtype.UUID {
	return pgtype.UUID{
		Bytes: v,
		Valid: true,
	}
}

func defaultContext() (context.Context, func()) {
	return context.WithTimeout(context.Background(), 3*time.Second)
}

func stringOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func isUniqueViolationErr(err error, constraint string) bool {
	pgErr, ok := perrors.Into[*pgconn.PgError](err)
	if !ok {
		return false
	}
	return pgErr.Code == pgerrcode.UniqueViolation && pgErr.ConstraintName == constraint
}

func trueCount(arg ...bool) int {
	c := 0
	for _, v := range arg {
		if v {
			c++
		}
	}
	return c
}
