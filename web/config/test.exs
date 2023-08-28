import Config

config :plantopo, :redis_url, "redis://localhost:6379/1"

config :plantopo, PlanTopo.Sync,
  host: "localhost",
  secret_key_base: "dwUOdWpKz0AMiveIc/D2MQezf9BNMl8/jVjj853iP8jcUuyUjeU8or937bblshYO"

config :plantopo, :sync_engine,
  log_level: "error",
  executable: "./run_sync_engine.sh"

aws_cred_value = fn key ->
  {value, 0} =
    System.cmd("bash", ["-c", "aws --profile test configure export-credentials | jq .#{key}"])

  value
  |> String.trim()
  |> String.trim("\"")
  |> String.to_charlist()
end

config :aws_credentials,
  aws_access_key_id: aws_cred_value.("AccessKeyId"),
  aws_secret_access_key: aws_cred_value.("SecretAccessKey"),
  aws_session_token: aws_cred_value.("SessionToken"),
  aws_region: ~c"eu-west-2"

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
