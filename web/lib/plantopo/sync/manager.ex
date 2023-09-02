defmodule PlanTopo.Sync.Manager do
  use GenServer

  require Logger

  defmodule State do
    defstruct [:engines, :store]
  end

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: opts[:name])
  end

  @impl true
  def init(opts) do
    store = Keyword.fetch!(opts, :store)
    Process.flag(:trap_exit, true)
    {:ok, %State{engines: BiMap.new(), store: store}}
  end

  @impl true
  def handle_call({:connect, map_id}, {client_pid, _}, state) do
    case BiMap.get(state.engines, map_id) do
      engine when is_pid(engine) ->
        {:ok, client_id} = GenServer.call(engine, {:connect, client_pid})
        {:reply, {:ok, client_id, engine}, state}

      nil ->
        {:ok, engine} =
          GenServer.start_link(PlanTopo.Sync.Engine, map_id: map_id, store: state.store)

        {:ok, client_id} = GenServer.call(engine, {:connect, client_pid})
        state = %{state | engines: BiMap.put(state.engines, map_id, engine)}
        {:reply, {:ok, client_id, engine}, state}
    end
  end

  @impl true
  def handle_info({:EXIT, pid, reason}, state) do
    map_id = BiMap.get_key(state.engines, pid)

    if is_nil(map_id) do
      Logger.debug(
        "Ignoring non-engine EXIT received by manager (pid is #{inspect(pid)}, reason is #{inspect(reason)})"
      )

      {:noreply, state}
    else
      if reason != :normal do
        Logger.warning(
          "Manager received unexpected sync engine exit (map is #{map_id}, reason is #{inspect(reason)}"
        )
      end

      {:noreply, %{state | engines: BiMap.delete_value(state.engines, pid)}}
    end
  end
end
