defmodule PlanTopo.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    minio_server_config = Application.get_env(:plantopo, :minio_server)

    children =
      [
        # Start the Telemetry supervisor
        PlanTopoWeb.Telemetry,
        # Start the Ecto repository
        PlanTopo.Repo,
        # Start the PubSub system
        {Phoenix.PubSub, name: PlanTopo.PubSub},
        # Start Finch
        {Finch, name: PlanTopo.Finch},
        {Cachex, name: PlanTopo.OSProxy.Cachex},
        # Start the Endpoint (http/https)
        PlanTopoWeb.Endpoint,
        maybe_os_proxy_spec(),
        if(!is_nil(minio_server_config), do: {MinioServer, minio_server_config})
      ]
      |> Enum.filter(&(!is_nil(&1)))

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: PlanTopo.Supervisor]
    {:ok, sup_pid} = Supervisor.start_link(children, opts)

    :locus.start_loader(:city, {:maxmind, "GeoLite2-City"})

    if !is_nil(minio_server_config), do: maybe_seed_minio()

    {:ok, sup_pid}
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    PlanTopoWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp maybe_os_proxy_spec do
    with config when not is_nil(config) <- Application.get_env(:plantopo, PlanTopoWeb.OSProxy) do
      ip = Keyword.fetch!(config, :ip)
      port = Keyword.fetch!(config, :port)

      Logger.info("Running PlanTopoWeb.OSProxy on #{:inet.ntoa(ip)}:#{port}")

      {Plug.Cowboy, scheme: :http, plug: PlanTopoWeb.OSProxy, options: [ip: ip, port: port]}
    end
  end

  defp maybe_seed_minio do
    alias ExAws.S3

    # Reduce retry errors from minio not finishing starting yet. We don't care
    # this is hacky because we don't use minio in prod
    Process.sleep(500)

    case S3.head_bucket("minio-is-seeded") |> ExAws.request() do
      {:error, {:http_error, 404, _}} ->
        S3.put_bucket("map-view-icon", "local") |> ExAws.request!()
        S3.put_bucket("minio-is-seeded", "local") |> ExAws.request!()

      {:ok, _} ->
        nil
    end
  end
end
