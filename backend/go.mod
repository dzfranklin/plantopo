module github.com/dzfranklin/plantopo/backend

go 1.23.0

require (
	cgt.name/pkg/go-mwclient v1.3.0
	github.com/DataDog/go-sqllexer v0.0.14
	github.com/airbusgeo/godal v0.0.13
	github.com/andybalholm/cascadia v1.3.2
	github.com/cenkalti/backoff/v4 v4.3.0
	github.com/cridenour/go-postgis v1.0.0
	github.com/davidbyttow/govips/v2 v2.15.0
	github.com/flatgeobuf/flatgeobuf/src/go v0.0.0-20240906191217-1d3647cec277
	github.com/go-faster/errors v0.7.1
	github.com/go-faster/jx v1.1.0
	github.com/go-playground/form v3.1.4+incompatible
	github.com/google/flatbuffers v24.3.25+incompatible
	github.com/google/uuid v1.6.0
	github.com/gosimple/slug v1.14.0
	github.com/hasura/go-graphql-client v0.13.0
	github.com/hdt3213/rdb v1.0.18
	github.com/jackc/pgerrcode v0.0.0-20240316143900-6e2875d9b438
	github.com/jackc/pgx/v5 v5.7.1
	github.com/joho/godotenv v1.5.1
	github.com/lmittmann/tint v1.0.5
	github.com/minio/minio-go/v7 v7.0.76
	github.com/mmcdole/gofeed v1.3.0
	github.com/neilotoole/slogt v1.1.0
	github.com/ogen-go/ogen v1.3.0
	github.com/oklog/ulid/v2 v2.1.0
	github.com/paulmach/orb v0.11.1
	github.com/paulmach/osm v0.8.0
	github.com/prometheus/client_golang v1.20.2
	github.com/redis/go-redis/v9 v9.6.1
	github.com/riverqueue/river v0.11.4
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.11.4
	github.com/riverqueue/river/rivertype v0.11.4
	github.com/robfig/cron/v3 v3.0.1
	github.com/spf13/cobra v1.8.1
	github.com/stretchr/testify v1.9.0
	github.com/testcontainers/testcontainers-go v0.33.0
	github.com/testcontainers/testcontainers-go/modules/minio v0.33.0
	github.com/testcontainers/testcontainers-go/modules/postgres v0.33.0
	github.com/testcontainers/testcontainers-go/modules/redis v0.33.0
	github.com/throttled/throttled/v2 v2.12.0
	github.com/tidwall/geojson v1.4.5
	github.com/tidwall/gjson v1.17.3
	github.com/tidwall/rtree v1.10.0
	github.com/trustelem/zxcvbn v1.0.1
	github.com/twilio/twilio-go v1.22.4
	github.com/twpayne/go-geom v1.5.7
	github.com/twpayne/go-polyline v1.1.1
	github.com/twpayne/go-proj/v10 v10.2.0
	github.com/twpayne/pgx-geom v0.0.2
	github.com/uniplaces/carbon v0.2.2
	github.com/urfave/negroni v1.0.0
	github.com/wneessen/go-mail v0.4.3
	go.opentelemetry.io/otel v1.29.0
	go.opentelemetry.io/otel/metric v1.29.0
	go.opentelemetry.io/otel/trace v1.29.0
	go.uber.org/automaxprocs v1.6.0
	go.uber.org/multierr v1.11.0
	golang.org/x/crypto v0.28.0
	golang.org/x/net v0.30.0
	golang.org/x/sync v0.8.0
	golang.org/x/text v0.19.0
	riverqueue.com/riverui v0.5.0
)

require (
	cloud.google.com/go/compute/metadata v0.3.0 // indirect
	dario.cat/mergo v1.0.1 // indirect
	github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24 // indirect
	github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 // indirect
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/PuerkitoBio/goquery v1.9.2 // indirect
	github.com/antonholmquist/jason v1.0.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bytedance/sonic v1.12.2 // indirect
	github.com/bytedance/sonic/loader v0.2.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/cloudwego/base64x v0.1.4 // indirect
	github.com/cloudwego/iasm v0.2.0 // indirect
	github.com/containerd/log v0.1.0 // indirect
	github.com/containerd/platforms v0.2.1 // indirect
	github.com/cpuguy83/dockercfg v0.3.1 // indirect
	github.com/datadog/czlib v0.0.0-20160811164712-4bc9a24e37f2 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/distribution/reference v0.6.0 // indirect
	github.com/dlclark/regexp2 v1.11.4 // indirect
	github.com/docker/docker v27.2.0+incompatible // indirect
	github.com/docker/go-connections v0.5.0 // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/fatih/color v1.17.0 // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/gabriel-vasile/mimetype v1.4.5 // indirect
	github.com/ghodss/yaml v1.0.0 // indirect
	github.com/go-faster/yaml v0.4.6 // indirect
	github.com/go-ini/ini v1.67.0 // indirect
	github.com/go-logr/logr v1.4.2 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.22.0 // indirect
	github.com/goccy/go-json v0.10.3 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/mock v1.6.0 // indirect
	github.com/gosimple/unidecode v1.0.1 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/klauspost/compress v1.17.9 // indirect
	github.com/klauspost/cpuid/v2 v2.2.8 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/lufia/plan9stats v0.0.0-20240819163618-b1d8f4d146e7 // indirect
	github.com/magiconair/properties v1.8.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/minio/md5-simd v1.1.2 // indirect
	github.com/mmcdole/goxpp v1.1.1 // indirect
	github.com/moby/docker-image-spec v1.3.1 // indirect
	github.com/moby/patternmatcher v0.6.0 // indirect
	github.com/moby/sys/sequential v0.6.0 // indirect
	github.com/moby/sys/user v0.3.0 // indirect
	github.com/moby/sys/userns v0.1.0 // indirect
	github.com/moby/term v0.5.0 // indirect
	github.com/morikuni/aec v1.0.0 // indirect
	github.com/mrjones/oauth v0.0.0-20190623134757-126b35219450 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.1.0 // indirect
	github.com/paulmach/protoscan v0.2.1 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
	github.com/prometheus/client_model v0.6.1 // indirect
	github.com/prometheus/common v0.57.0 // indirect
	github.com/prometheus/procfs v0.15.1 // indirect
	github.com/riverqueue/river/riverdriver v0.11.4 // indirect
	github.com/riverqueue/river/rivershared v0.11.4 // indirect
	github.com/rs/xid v1.6.0 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/shirou/gopsutil/v3 v3.24.5 // indirect
	github.com/shoenig/go-m1cpu v0.1.6 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/test-go/testify v1.1.4 // indirect
	github.com/tidwall/geoindex v1.7.0 // indirect
	github.com/tidwall/match v1.1.1 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	github.com/tklauser/go-sysconf v0.3.14 // indirect
	github.com/tklauser/numcpus v0.8.0 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	go.mongodb.org/mongo-driver v1.17.1 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.54.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.19.0 // indirect
	go.uber.org/goleak v1.3.0 // indirect
	go.uber.org/zap v1.27.0 // indirect
	golang.org/x/arch v0.9.0 // indirect
	golang.org/x/exp v0.0.0-20240823005443-9b4947da3948 // indirect
	golang.org/x/image v0.21.0 // indirect
	golang.org/x/sys v0.26.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240827150818-7e3bb234dfed // indirect
	google.golang.org/grpc v1.66.0 // indirect
	google.golang.org/protobuf v1.34.2 // indirect
	gopkg.in/go-playground/assert.v1 v1.2.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	nhooyr.io/websocket v1.8.17 // indirect
)
