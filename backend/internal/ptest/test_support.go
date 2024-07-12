package ptest

import (
	"bytes"
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/minio/minio-go/v7"
	miniocredentials "github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/neilotoole/slogt"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	miniocontainers "github.com/testcontainers/testcontainers-go/modules/minio"
	postgrescontainers "github.com/testcontainers/testcontainers-go/modules/postgres"
	rediscontainers "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
	"github.com/throttled/throttled/v2"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// Images
const (
	pgImage    = "postgres:15.7-bookworm"
	redisImage = "redis:7.2-bookworm"
	minioImage = "minio/minio:RELEASE.2024-07-10T18-41-49Z"
)

const (
	dbName     = "plantopo_test"
	dbUser     = "plantopo_test"
	dbPassword = "password"
)

type TestEnv struct {
	*pconfig.Env
	t      *testing.T
	dbC    *postgrescontainers.PostgresContainer
	rdbC   *rediscontainers.RedisContainer
	minioC *miniocontainers.MinioContainer
}

func NewTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	te := &TestEnv{
		Env: &pconfig.Env{
			Config: &pconfig.Config{
				Env: "test",
				Users: pconfig.Users{
					LoginThrottle:       throttled.RateQuota{MaxRate: throttled.PerSec(10_000), MaxBurst: 10_000},
					MinPasswordStrength: 1,
					PasswordHashCost:    1,
				},
				Session: pconfig.Session{
					SessionIdleExpiry: 24 * time.Hour * 365,
				},
			},
			Logger: slogt.New(t, slogt.Factory(func(w io.Writer) slog.Handler {
				opts := &slog.HandlerOptions{
					AddSource: false,
					Level:     slog.LevelWarn,
				}
				if os.Getenv("TEST_VERBOSE_LOGS") != "" {
					opts.Level = slog.LevelDebug
				}
				return slog.NewTextHandler(w, opts)
			})),
		},
		t: t,
	}

	start := time.Now()
	setupFuncs := []func(){
		te.setupDB,
		te.setupRDB,
		te.setupMinio,
	}
	var wg sync.WaitGroup
	wg.Add(len(setupFuncs))
	for _, fn := range setupFuncs {
		go func() {
			defer wg.Done()
			fn()
		}()
	}
	wg.Wait()
	t.Logf("Setup test environment in %fs\n", time.Since(start).Seconds())

	return te
}

func (te *TestEnv) Reset() {
	t := te.t
	ctx := context.Background()

	resetPostgres := func() {
		te.DB.Close()
		err := te.dbC.Restore(ctx)
		require.NoError(t, err)
		te.connectDB()
	}

	resetRedis := func() {
		err := te.RDB.FlushAll(ctx).Err()
		require.NoError(t, err)
	}

	resetMinio := func() {
		objects := te.Objects

		buckets, err := objects.ListBuckets(ctx)
		require.NoError(t, err)

		var wg sync.WaitGroup
		wg.Add(len(buckets))
		for _, bucket := range buckets {
			go func() {
				defer wg.Done()
				err := objects.RemoveBucketWithOptions(ctx, bucket.Name, minio.RemoveBucketOptions{ForceDelete: true})
				require.NoError(t, err)
			}()
		}
		wg.Wait()
	}

	resetFuncs := []func(){
		resetPostgres,
		resetRedis,
		resetMinio,
	}
	var wg sync.WaitGroup
	wg.Add(len(resetFuncs))
	for _, fn := range resetFuncs {
		go func() {
			defer wg.Done()
			fn()
		}()
	}
	wg.Wait()
}

func (te *TestEnv) setupRDB() {
	t := te.t
	ctx := context.Background()

	c, err := rediscontainers.Run(ctx, redisImage)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if err := c.Terminate(ctx); err != nil {
			t.Fatal(err)
		}
	})

	connString, err := c.ConnectionString(ctx)
	if err != nil {
		t.Fatal(err)
	}

	opts, err := redis.ParseURL(connString)
	if err != nil {
		t.Fatal(err)
	}

	te.rdbC = c
	te.RDB = redis.NewClient(opts)
}

func (te *TestEnv) setupDB() {
	t := te.t
	ctx := context.Background()

	c, err := postgrescontainers.Run(ctx, pgImage,
		postgrescontainers.WithDatabase(dbName),
		postgrescontainers.WithUsername(dbUser),
		postgrescontainers.WithPassword(dbPassword),
		postgrescontainers.WithSQLDriver("pgx"),
		testcontainers.WithWaitStrategy(
			// First, we wait for the container to log readiness twice.
			// This is because it will restart itself after the first startup.
			wait.ForLog("database system is ready to accept connections").WithOccurrence(2),
			// Then, we wait for docker to actually serve the port on localhost.
			// For non-linux OSes like Mac and Windows, Docker or Rancher Desktop will have to start a separate proxy.
			// Without this, the tests will be flaky on those OSes!
			wait.ForListeningPort("5432/tcp"),
		))
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if err := c.Terminate(ctx); err != nil {
			t.Fatal(err)
		}
	})

	connString, err := c.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	runMigrations(t, connString)

	err = c.CopyFileToContainer(ctx, gitRoot(t)+"/backend/test_seeds.sql", "/test_seeds.sql", 0777)
	if err != nil {
		t.Fatal(err)
	}
	status, resp, err := c.Exec(ctx, []string{"bash", "-c", `psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /test_seeds.sql`})
	if err != nil {
		t.Fatal(err)
	}
	if status != 0 {
		_, _ = io.Copy(os.Stdout, resp)
		t.Fatal("Running test_seeds.sql failed")
	}

	err = c.Snapshot(ctx, postgrescontainers.WithSnapshotName("test-snapshot"))
	if err != nil {
		t.Fatal(err)
	}

	te.dbC = c
	te.connectDB()
}

func (te *TestEnv) connectDB() {
	ctx := context.Background()
	connString, err := te.dbC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		te.t.Fatal(err)
	}
	db, err := pgxpool.New(ctx, connString)
	if err != nil {
		te.t.Fatal(err)
	}
	te.DB = db
}

func (te *TestEnv) setupMinio() {
	ctx := context.Background()
	t := te.t

	c, err := miniocontainers.Run(ctx, minioImage,
		miniocontainers.WithUsername("test"),
		miniocontainers.WithPassword("password"))
	require.NoError(t, err)

	t.Cleanup(func() {
		require.NoError(t, c.Terminate(ctx))
	})

	connString, err := c.ConnectionString(ctx)
	require.NoError(t, err)

	client, err := minio.New(connString, &minio.Options{
		Secure: false,
		Creds:  miniocredentials.NewStaticV4("test", "password", ""),
	})
	require.NoError(t, err)

	te.Objects = client
}

func runMigrations(t *testing.T, connString string) []byte {
	var out bytes.Buffer
	cmd := exec.Command("tern", "migrate", "--conn-string", connString)
	cmd.Dir = gitRoot(t) + "/backend/migrations"
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

var (
	gitRootCache   string
	gitRootCacheMu sync.Mutex
)

func gitRoot(t *testing.T) string {
	gitRootCacheMu.Lock()
	defer gitRootCacheMu.Unlock()

	if gitRootCache != "" {
		return gitRootCache
	}

	curr, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}

	for {
		entries, err := os.ReadDir(curr)
		if err != nil {
			t.Fatal(err)
		}

		for _, entry := range entries {
			if entry.IsDir() && entry.Name() == ".git" {
				gitRootCache = curr
				return curr
			}
		}

		if curr == "/" {
			t.Fatal("This test must be run from within the git repository")
		}

		curr = filepath.Dir(curr)
	}
}
