defmodule PlanTopo.Sync do
  import __MODULE__.EngineNative, only: [message_decode: 1]
  require OpenTelemetry.Tracer, as: Tracer

  def connect!(map, meta, fallback_center, parent_span) do
    Tracer.with_span "sync connect", %{
      attributes: [{"map", map}, {"meta", meta}, {"fallback_center", fallback_center}]
    } do
      {:ok, engine} = GenServer.call(__MODULE__.Manager, {:get, map, parent_span})

      :ok =
        GenServer.call(
          engine,
          {:connect, %{meta: meta, fallback_center: fallback_center}, parent_span}
        )

      engine
    end
  end

  def handle_recv!(engine, msg, parent_span) do
    {:ok, messages} = message_decode(msg)
    GenServer.call(engine, {:recv, messages, parent_span})
  end

  @doc """
  Shouldn't be needed for normal use
  """
  def kill_by_map!(map) do
    :ok = GenServer.call(__MODULE__.Manager, {:kill, map})
  end
end
