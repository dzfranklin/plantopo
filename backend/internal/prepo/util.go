package prepo

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/binary"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"io"
	"strings"
	"time"
)

type M map[string]any
type SM map[string]string

var (
	q           = psqlc.New()
	idByteOrder = binary.BigEndian
	// Crockford's alphabet
	idEncoding = base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz").WithPadding(base32.NoPadding)
)

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

func pgOptTime(v time.Time) pgtype.Timestamp {
	if v.IsZero() {
		return pgtype.Timestamp{}
	} else {
		return pgtype.Timestamp{Valid: true, Time: v}
	}
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

func SerialToID(kind string, v int64) string {
	b := make([]byte, 8)
	idByteOrder.PutUint64(b, uint64(v))
	return kind + "_" + idEncoding.EncodeToString(b)
}

func UUIDToID(kind string, v uuid.UUID) string {
	return kind + "_" + idEncoding.EncodeToString(v[:])
}

func SecureRandomID(kind string, byteSize int) string {
	v := make([]byte, byteSize)
	if _, err := io.ReadFull(rand.Reader, v); err != nil {
		panic("failed to read random bytes")
	}
	return kind + "_" + idEncoding.EncodeToString(v)
}

func IDToSerial(kind string, v string) (int64, error) {
	prefix := kind + "_"
	if !strings.HasPrefix(v, prefix) {
		return 0, ErrInvalidID
	}
	v = v[len(prefix):]
	b, err := idEncoding.DecodeString(v)
	if err != nil {
		return 0, ErrInvalidID
	}
	return int64(idByteOrder.Uint64(b)), nil
}

func IDToUUID(kind string, v string) (uuid.UUID, error) {
	prefix := kind + "_"
	if !strings.HasPrefix(v, prefix) {
		return uuid.Nil, ErrInvalidID
	}
	v = v[len(prefix):]
	b, err := idEncoding.DecodeString(v)
	if err != nil {
		return uuid.Nil, ErrInvalidID
	}
	if len(b) != 16 {
		return uuid.Nil, ErrInvalidID
	}
	return *(*[16]byte)(b), nil
}

func isUniqueViolationErr(err error, constraint string) bool {
	pgErr, ok := perrors.Into[*pgconn.PgError](err)
	if !ok {
		return false
	}
	return pgErr.Code == pgerrcode.UniqueViolation && pgErr.ConstraintName == constraint
}
