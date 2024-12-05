package ptest

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pmigrate"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	rdbdump "github.com/hdt3213/rdb/helper"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	miniocredentials "github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/neilotoole/slogt"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
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
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// Images
const (
	pgImage    = "postgis/postgis:16-3.4"
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
	t    *testing.T
	dbC  *postgrescontainers.PostgresContainer
	rdbC *rediscontainers.RedisContainer
}

var loadedTestEnv = false
var loadTestEnvMu sync.Mutex

func NewTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	if testing.Short() {
		t.Skip("NewTestEnv: skipping in short mode")
	}

	loadTestEnvMu.Lock()
	if !loadedTestEnv {
		if err := godotenv.Load(GitRoot()+"/backend/.env", GitRoot()+"/backend/.env.local"); err != nil {
			t.Log("load dotenv", err)
		}
		loadedTestEnv = true
	}
	loadTestEnvMu.Unlock()

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
			Logger:       NewTestLogger(t),
			FlagProvider: &TestFlagProvider{},
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

	te.setupJobs()

	t.Logf("Setup test environment in %fs\n", time.Since(start).Seconds())

	return te
}

func (te *TestEnv) Reset() {
	t := te.t
	ctx := context.Background()

	te.Env.FlagProvider.(*TestFlagProvider).Reset()

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

	te.setupJobs()
}

func (te *TestEnv) setupRDB() {
	t := te.t
	ctx := context.Background()

	c, err := rediscontainers.Run(ctx, redisImage)
	if err != nil {
		panic(err)
	}

	t.Cleanup(func() {
		if err := c.Terminate(ctx); err != nil {
			panic(err)
		}
	})

	connString, err := c.ConnectionString(ctx)
	if err != nil {
		panic(err)
	}

	opts, err := redis.ParseURL(connString)
	if err != nil {
		panic(err)
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
		testcontainers.WithEnv(map[string]string{"TZ": "UTC"}),
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
		panic(err)
	}

	t.Cleanup(func() {
		if err := c.Terminate(ctx); err != nil {
			panic(err)
		}
	})

	connString, err := c.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		panic(err)
	}

	runMigrations(connString)

	err = c.CopyFileToContainer(ctx, GitRoot()+"/backend/test_seeds.sql", "/test_seeds.sql", 0777)
	if err != nil {
		panic(err)
	}
	status, resp, err := c.Exec(ctx, []string{"bash", "-c", `psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /test_seeds.sql`})
	if err != nil {
		panic(err)
	}
	if status != 0 {
		_, _ = io.Copy(os.Stdout, resp)
		panic("Running test_seeds.sql failed")
	}

	err = c.Snapshot(ctx, postgrescontainers.WithSnapshotName("test-snapshot"))
	if err != nil {
		panic(err)
	}

	te.dbC = c
	te.connectDB()
}

func (te *TestEnv) connectDB() {
	ctx := context.Background()

	connString, err := te.dbC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		panic(err)
	}

	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		panic(err)
	}

	psqlc.ConfigurePool(config)

	db, err := pgxpool.NewWithConfig(ctx, config)

	if err != nil {
		panic(err)
	}
	te.DB = db
}

func (te *TestEnv) setupJobs() {
	var err error
	te.Jobs, err = river.NewClient[pgx.Tx](riverpgxv5.New(te.DB), &river.Config{})
	if err != nil {
		panic(err)
	}
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

	for _, bucketName := range []string{"munro-access-reports"} {
		err = client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		require.NoError(t, err)
	}

	te.Objects = client
}

func runMigrations(connString string) {
	dbPool, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		panic(err)
	}
	defer dbPool.Close()

	riverMigrator := rivermigrate.New(riverpgxv5.New(dbPool), nil)
	_, err = riverMigrator.Migrate(context.Background(), rivermigrate.DirectionUp, nil)
	if err != nil {
		panic(err)
	}

	conn, err := dbPool.Acquire(context.Background())
	if err != nil {
		panic(err)
	}
	defer conn.Release()
	pgConn := conn.Conn().PgConn()

	genResults, err := pgConn.Exec(context.Background(), pmigrate.SQLToGenerateMigrationsSQL).ReadAll()
	if err != nil {
		panic(err)
	}

	var migrationSQL strings.Builder
	for _, genResult := range genResults {
		for _, row := range genResult.Rows {
			stmt := row[0]
			migrationSQL.Write(stmt)
		}
	}

	if _, err := pgConn.Exec(context.Background(), migrationSQL.String()).ReadAll(); err != nil {
		panic(err)
	}
}

func (te *TestEnv) DumpRDB() string {
	rdb := te.RDB
	ctx := context.Background()

	if err := rdb.Save(ctx).Err(); err != nil {
		panic(err)
	}
	dumpR, err := te.rdbC.CopyFileFromContainer(ctx, "/data/dump.rdb")
	if err != nil {
		panic(err)
	}
	dumpF, err := os.CreateTemp("", "dump*.rdb")
	if err != nil {
		panic(err)
	}
	defer func() { _ = os.Remove(dumpF.Name()) }()
	if _, err := io.Copy(dumpF, dumpR); err != nil {
		panic(err)
	}

	valF, err := os.CreateTemp("", "dump*")
	if err != nil {
		panic(err)
	}
	defer func() { _ = os.Remove(valF.Name()) }()
	if err := rdbdump.ToJsons(dumpF.Name(), valF.Name()); err != nil {
		panic(err)
	}
	val, err := os.ReadFile(valF.Name())
	if err != nil {
		panic(err)
	}

	return string(val)
}

var (
	gitRootCache   string
	gitRootCacheMu sync.Mutex
)

func GitRoot() string {
	gitRootCacheMu.Lock()
	defer gitRootCacheMu.Unlock()

	if gitRootCache != "" {
		return gitRootCache
	}

	curr, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	for {
		entries, err := os.ReadDir(curr)
		if err != nil {
			panic(err)
		}

		for _, entry := range entries {
			if entry.IsDir() && entry.Name() == ".git" {
				gitRootCache = curr
				return curr
			}
		}

		if curr == "/" {
			panic("This test must be run from within the git repository")
		}

		curr = filepath.Dir(curr)
	}
}

func NewTestLogger(t *testing.T) *slog.Logger {
	return slogt.New(t, slogt.Factory(func(w io.Writer) slog.Handler {
		opts := &slog.HandlerOptions{
			AddSource: false,
			Level:     slog.LevelWarn,
		}
		if os.Getenv("TEST_VERBOSE_LOGS") != "" {
			opts.Level = slog.LevelDebug
			fmt.Println("TEST_VERBOSE_LOGS enabled")
		}
		return slog.NewTextHandler(w, opts)
	}))
}

func LoadDevEnv(t *testing.T) *pconfig.Config {
	t.Helper()
	root := GitRoot()
	_ = godotenv.Load(root+"/backend/.env", root+"/backend/.env.local")
	return pconfig.Read()
}

type TestFlagProvider struct {
	boolFlags map[string]bool
	mu        sync.Mutex
}

func (p *TestFlagProvider) BoolFlag(key string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.boolFlags[key]
}

func (p *TestFlagProvider) SetBoolFlag(key string, value bool) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.boolFlags == nil {
		p.boolFlags = make(map[string]bool)
	}

	p.boolFlags[key] = value

	return nil
}

func (p *TestFlagProvider) DeleteBoolFlag(key string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.boolFlags, key)
	return nil
}

func (p *TestFlagProvider) ListBoolFlags() map[string]bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make(map[string]bool, len(p.boolFlags))
	for k, v := range p.boolFlags {
		out[k] = v
	}
	return out
}

func (p *TestFlagProvider) Reset() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.boolFlags = nil
}

func Must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}
