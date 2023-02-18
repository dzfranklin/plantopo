import Config

s3_config = [
  access_key_id: "admin",
  secret_access_key: "adminkey",
  scheme: "http://",
  region: "local",
  host: "127.0.0.1",
  port: 9020,
  # Minio specific
  minio_path: ".minio/test_e2e",
  minio_executable: "minio",
  ui: false
]

config :ex_aws, :s3, s3_config
config :plantopo, :minio_server, s3_config

# Configure your database
config :plantopo, PlanTopo.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "plantopo_test_e2e",
  pool_size: 10

config :plantopo, PlanTopoWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4010],
  secret_key_base: "9542sprf0MCAkYRezHR7eGdwL2JVPEBsLgaP9I+dSYyrPPiLXXIu53QhCHijMuiK",
  server: true

config :plantopo, PlanTopoWeb.OSProxy,
  ip: {127, 0, 0, 1},
  port: 4013

# In test we don't send emails.
config :plantopo, PlanTopo.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters.
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
