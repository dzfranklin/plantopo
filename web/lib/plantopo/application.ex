defmodule PlanTopo.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    children = [
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
      os_proxy_spec()
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
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

  defp os_proxy_spec do
    config = Application.fetch_env!(:plantopo, PlanTopoWeb.OSProxy)
    ip = Keyword.fetch!(config, :ip)
    port = Keyword.fetch!(config, :port)

    Logger.info("Running PlanTopoWeb.OSProxy on #{:inet.ntoa(ip)}:#{port}")

    {Plug.Cowboy, scheme: :http, plug: PlanTopoWeb.OSProxy, options: [ip: ip, port: port]}
  end
end
