package prepo

import (
	"crypto/rand"
	"github.com/google/uuid"
	"io"
	"strconv"
	"strings"
)

const (
	auditLogIDKind                 = "al"
	auditLogCursorKind             = "alcur"
	authorizedSMSSenderIDKind      = "asmss"
	britishAndIrishHillPhotoIDKind = "bihp"
	trackIDKind                    = "t"
	userIDKind                     = "u"
)

func IntToID(kind string, v int64) string {
	return kind + "_" + strconv.FormatInt(v, 10)
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

func IDToInt(kind string, v string) (int64, error) {
	prefix := kind + "_"
	if !strings.HasPrefix(v, prefix) {
		return 0, ErrInvalidID
	}
	v = v[len(prefix):]
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0, ErrInvalidID
	}
	return n, nil
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
