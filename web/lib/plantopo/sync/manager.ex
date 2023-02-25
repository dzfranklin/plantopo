defmodule PlanTopo.Sync.Manager do
  @moduledoc """
  Manages Engine servers for each map
  """
  use GenServer
  require Logger
  alias PlanTopo.Sync

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_ops) do
    Process.flag(:trap_exit, true)
    {:ok, BiMap.new()}
  end

  @impl true
  def handle_call({:get, map}, _from, state) do
    engine = BiMap.get(state, map)

    if is_nil(engine) do
      case Sync.Engine.start_link(map) do
        {:ok, engine} ->
          {:reply, {:ok, engine}, BiMap.put(state, map, engine)}

        {:error, error} ->
          {:reply, {:error, error}, state}
      end
    else
      {:reply, {:ok, engine}, state}
    end
  end

  @impl true
  def handle_call({:kill, map}, _from, state) do
    engine = BiMap.get(state, map)

    if is_nil(engine) do
      {:reply, {:error, :not_found}, state}
    else
      Process.exit(engine, :manager_kill)
      {:reply, :ok, state}
    end
  end

  @impl true
  def handle_info({:EXIT, engine, reason}, state) do
    map = BiMap.get_key(state, engine)
    state = BiMap.delete_key(state, map)

    case reason do
      :normal -> nil
      reason -> Logger.warn("Engine exited abnormally [map=#{inspect(map)}]: #{inspect(reason)}")
    end

    {:noreply, state}
  end
end
