defmodule PlanTopo.Sync.Manager do
  use GenServer

  require Logger

  defmodule State do
    defstruct [:engines]
  end

  def start_link(opts) do
    GenServer.start_link(__MODULE__, [], name: opts[:name])
  end

  @impl true
  def init(_opts) do
    Process.flag(:trap_exit, true)

    {:ok, %State{engines: BiMap.new()}}
  end

  @impl true
  def handle_call({:connect, map_id}, {client_pid, _}, state) do
    case BiMap.get(state.engines, map_id) do
      engine when is_pid(engine) ->
        {:ok, client_id} = GenServer.call(engine, {:connect, client_pid})
        {:reply, {:ok, client_id, engine}, state}

      nil ->
        {:ok, engine} = GenServer.start_link(PlanTopo.Sync.Engine, map_id: map_id)
        {:ok, client_id} = GenServer.call(engine, {:connect, client_pid})
        state = %{state | engines: BiMap.put(state.engines, map_id, engine)}
        {:reply, {:ok, client_id, engine}, state}
    end
  end

  @impl true
  def handle_info({:EXIT, pid, reason}, state) do
    case BiMap.get_key(state.engines, pid) do
      map_id when not is_nil(map_id) ->
        Logger.warn(
          "Manager received sync engine exit: #{inspect(%{map_id: map_id, reason: reason})}"
        )

        {:noreply, %{state | engines: BiMap.delete_value(state.engines, pid)}}

      nil ->
        Logger.debug(
          "Ignoring non-engine EXIT received by manager: #{inspect(%{pid: pid, reason: reason})}"
        )

        {:noreply, state}
    end
  end
end
