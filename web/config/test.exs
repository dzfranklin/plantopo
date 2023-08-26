import Config

config :plantopo, :sync_engine,
  log_level: "error",
  store: "redis://localhost:6379/1",
  executable: "./run_sync_engine.sh"

s3_config = [
  access_key_id: "admin",
  secret_access_key: "adminkey",
  scheme: "http://",
  region: "local",
  host: "127.0.0.1",
  port: 9010,
  # Minio specific
  minio_path: ".minio/test_e2e",
  minio_executable: "minio",
  ui: false
]

config :ex_aws, :s3, s3_config
config :plantopo, :minio_server, s3_config

# Only in tests, remove the complexity from the password hashing algorithm
config :bcrypt_elixir, :log_rounds, 1

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :plantopo, PlanTopo.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "plantopo_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 10

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :plantopo, PlanTopoWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "0xE4u5mbB1Pky5bqSDKaOcnkSTMcK61oPz7swkdC0Kzjf7SsM3Xv6Gq3AlZbAwEb",
  server: false

# In test we don't send emails.
config :plantopo, PlanTopo.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters.
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
