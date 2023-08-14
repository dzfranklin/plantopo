defmodule PlanTopo.Sync do
  require Logger
  alias __MODULE__.Manager

  @type engine :: pid()

  @spec connect(%{
          map_id: number(),
          client_id: number(),
          token: String.t()
        }) :: {:ok, engine()}
  def connect(opts) do
    Logger.warn("TODO: Check auth token")

    args = %{map_id: opts.map_id, client_id: opts.client_id}

    with {:ok, engine} <- GenServer.call(Manager, {:connect, args}) do
      Process.link(engine)
      {:ok, engine}
    end
  end

  @spec recv(engine(), number(), any()) :: :ok
  def recv(engine, client_id, op) do
    GenServer.call(engine, {:recv, client_id, op})
  end
end
