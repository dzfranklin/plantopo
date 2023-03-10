defmodule PlanTopo.Sync.Manager do
  @moduledoc """
  Manages Engine servers for each map
  """
  use GenServer
  require Logger
  alias PlanTopo.Sync
  require OpenTelemetry.Tracer, as: Tracer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_ops) do
    Process.flag(:trap_exit, true)
    {:ok, BiMap.new()}
  end

  @impl true
  def handle_call({:get, map, parent_span}, _from, state) do
    link = OpenTelemetry.link(parent_span)

    Tracer.with_span "manager get engine", %{links: [link], attributes: [{"map", map}]} do
      engine = BiMap.get(state, map)

      if is_nil(engine) do
        case Sync.Engine.start_link(map: map, init_parent_span: parent_span) do
          {:ok, engine} ->
            Tracer.add_event("replying with new engine", [])
            {:reply, {:ok, engine}, BiMap.put(state, map, engine)}

          {:error, error} ->
            {:reply, {:error, error}, state}
        end
      else
        Tracer.add_event("replying with existing engine", [])
        {:reply, {:ok, engine}, state}
      end
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
    Tracer.with_span "manager handle exit" do
      map = BiMap.get_key(state, engine)
      state = BiMap.delete_key(state, map)

      case reason do
        :normal ->
          nil

        reason ->
          Logger.warn("Engine exited abnormally [map=#{inspect(map)}]: #{inspect(reason)}")
      end

      {:noreply, state}
    end
  end
end
