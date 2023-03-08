defmodule PlanTopo.Sync do
  def connect!(map, meta, fallback_center) do
    {:ok, engine} = GenServer.call(__MODULE__.Manager, {:get, map})
    :ok = GenServer.call(engine, {:connect, %{meta: meta, fallback_center: fallback_center}})
    engine
  end

  def handle_recv!(engine, msg) do
    :ok = GenServer.call(engine, {:recv, msg})
  end

  @doc """
  Shouldn't be needed for normal use
  """
  def kill_by_map!(map) do
    :ok = GenServer.call(__MODULE__.Manager, {:kill, map})
  end
end
