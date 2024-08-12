package ptest

import (
	"context"
	"github.com/minio/minio-go/v7"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"strings"
	"testing"
)

func TestNewTestEnv(t *testing.T) {
	t.Parallel()
	env := NewTestEnv(t)

	t.Run("initially", func(t *testing.T) {
		checkTestEnv(t, env)
	})

	env.Reset()

	t.Run("after reset", func(t *testing.T) {
		checkTestEnv(t, env)
	})
}

func checkTestEnv(t *testing.T, env *TestEnv) {
	ctx := context.Background()

	// Check postgres

	db := env.DB

	err := db.Ping(ctx)
	require.NoError(t, err)

	var testUserEmail string
	err = db.QueryRow(ctx, "SELECT email FROM users WHERE id = '11111111-11111111-11111111-11111111'").Scan(&testUserEmail)
	require.NoError(t, err)
	assert.Equal(t, "test@example.com", testUserEmail)

	// Check redis

	rdb := env.RDB

	err = rdb.Ping(ctx).Err()
	require.NoError(t, err)

	dbSize, err := rdb.DBSize(ctx).Result()
	require.NoError(t, err)
	require.Equal(t, int64(0), dbSize)

	err = rdb.Set(ctx, "foo", "bar", 0).Err()
	require.NoError(t, err)

	dbSize, err = rdb.DBSize(ctx).Result()
	require.NoError(t, err)
	require.Equal(t, int64(1), dbSize)

	// Check minio

	objects := env.Objects

	hasBucket, err := objects.BucketExists(ctx, "test")
	require.NoError(t, err)
	require.False(t, hasBucket)

	err = objects.MakeBucket(ctx, "test", minio.MakeBucketOptions{})
	require.NoError(t, err)

	testBody := strings.NewReader("test_body")
	_, err = objects.PutObject(ctx, "test", "test_object",
		testBody, int64(testBody.Len()), minio.PutObjectOptions{})
	require.NoError(t, err)

	hasBucket, err = objects.BucketExists(ctx, "test")
	require.NoError(t, err)
	require.True(t, hasBucket)
}
