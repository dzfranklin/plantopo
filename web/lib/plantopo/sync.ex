defmodule PlanTopo.Sync do
  require Logger
  alias __MODULE__.Manager

  @type engine :: pid()
  @type client_id :: number()

  @spec connect(%{
          map_id: number(),
          token: String.t()
        }) :: {:ok, client_id(), engine()}
  def connect(opts) do
    Logger.warn("TODO: Check auth token")

    with {:ok, client_id, engine} <- GenServer.call(Manager, {:connect, opts.map_id}) do
      Process.link(engine)
      {:ok, client_id, engine}
    end
  end

  @spec recv(engine(), number(), any()) :: :ok
  def recv(engine, client_id, msg) do
    GenServer.call(engine, {:recv, client_id, msg})
  end
end
