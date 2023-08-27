defmodule PlanTopo.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    :ok = :opentelemetry_cowboy.setup()
    :ok = OpentelemetryPhoenix.setup(adapter: :cowboy2)
    :ok = OpentelemetryEcto.setup([:plantopo, :repo])

    :ok = :locus.start_loader(:city, {:maxmind, "GeoLite2-City"})

    sync_host = Application.fetch_env!(:plantopo, PlanTopo.Sync) |> Keyword.fetch!(:host)

    sync_store_config = %{
      redis_url: Application.fetch_env!(:plantopo, :redis_url),
      snapshot_url: "https://#{sync_host}/api/sync_server/snapshot",
      snapshot_token: PlanTopo.Sync.mint_server_snapshot_token()
    }

    sync_store = {"prod", Jason.encode!(sync_store_config)}

    children =
      [
        # Start the Telemetry supervisor
        PlanTopoWeb.Telemetry,
        {Task.Supervisor, name: PlanTopo.TaskSupervisor},
        # Start the Ecto repository
        PlanTopo.Repo,
        # Start the PubSub system
        {Phoenix.PubSub, name: PlanTopo.PubSub},
        # Start Finch
        {Finch, name: PlanTopo.Finch},
        {PlanTopo.Sync.Manager, name: PlanTopo.Sync.Manager, store: sync_store},
        # Start the Endpoint (http/https)
        PlanTopoWeb.Endpoint,
        if(Application.get_env(:plantopo, :start_minio),
          do: {MinioServer, Application.get_env(:plantopo, :minio_server)}
        )
      ]
      |> Enum.filter(&(!is_nil(&1)))

    opts = [strategy: :one_for_one, name: PlanTopo.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    PlanTopoWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
