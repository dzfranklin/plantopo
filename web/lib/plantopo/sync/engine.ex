defmodule PlanTopo.Sync.Engine do
  @moduledoc """
  Manages the synchronization of a single map
  """
  use GenServer, restart: :temporary
  alias PlanTopo.Maps
  import PlanTopo.Sync.EngineNative
  require Logger

  @initial_view_at_tag 10
  @save_every_millis 1000 * 30
  @timeout_millis 1000 * 60

  def start_link(map, _ \\ []) do
    GenServer.start_link(__MODULE__, map: map)
  end

  @impl true
  def init(opts) do
    map = Keyword.fetch!(opts, :map)

    state =
      %{
        map: map,
        aware: awareness_new(),
        sockets: Map.new(),
        user_view_ats: Map.new(),
        last_recv: DateTime.utc_now()
      }
      |> bump_timeout()

    case Maps.get_last_snapshot_as_update(map) do
      nil ->
        Logger.info("Created engine [map=#{inspect(map)}] from blank")

      snapshot_update ->
        {:ok, _update} = apply_update(state.aware, snapshot_update)
        Logger.info("Created engine [map=#{inspect(map)}] from snapshot")
    end

    Process.send_after(self(), :snapshot, @save_every_millis)

    {:ok, state}
  end

  @impl true
  def terminate(reason, state) do
    if reason != :normal do
      Logger.warn("Sync engine terminating abnormally: #{inspect(reason)}")
    end

    save_state(state, false)

    reason
  end

  @impl true
  def handle_call({:connect, %{meta: meta, fallback_center: fallback_center}}, {caller, _}, state) do
    if Map.has_key?(state.sockets, caller) do
      {:reply, {:error, :already_connected}, state}
    else
      state = %{state | sockets: Map.put(state.sockets, caller, meta)}
      Process.monitor(caller)

      enc = message_encoder_new()
      :ok = encode_intro(state.aware, enc)

      case meta.user do
        nil ->
          view_at = Maps.make_fallback_view_at(nil, state.map, fallback_center)
          :ok = message_encoder_write(enc, initial_view_at_msg(view_at))

        user_id ->
          case Map.get(state.user_view_ats, user_id) do
            nil ->
              run_task(fn ->
                view_at = Maps.get_view_at(user_id, state.map)

                if not is_nil(view_at) do
                  {:ok, msg} = message_encode(initial_view_at_msg(view_at))
                  send(caller, {:send, msg})
                end
              end)

            value ->
              Logger.warn("got from mem")
              :ok = message_encoder_write(enc, initial_view_at_msg(value))
          end
      end

      {:ok, msg} = message_encoder_finish(enc)
      send(caller, {:send, msg})

      Logger.info("Connected #{inspect(caller)} to #{state.map} as #{inspect(meta)}")

      {:reply, :ok, bump_timeout(state)}
    end
  end

  @impl true
  def handle_call({:recv, msg}, {caller, _}, state) do
    aware = state.aware

    case Map.fetch(state.sockets, caller) do
      {:ok, meta} ->
        {reply, state} =
          case msg do
            {:sync_step1, sv} ->
              {:ok, update} = encode_state_as_update(aware, sv)
              {:ok, reply} = message_encode({:sync_step2, update})
              send(caller, {:send, reply})
              {:ok, state}

            {:sync_step2, update} ->
              if meta.role == :editor || meta.role == :owner do
                {:ok, update} = apply_update(aware, update)
                {:ok, bcast} = message_encode({:sync_update, update})
                broadcast(state, bcast)
                {:ok, state}
              else
                {{:error, :permission_denied}, state}
              end

            {:sync_update, update} ->
              if meta.role == :editor || meta.role == :owner do
                {:ok, update} = apply_update(aware, update)
                {:ok, bcast} = message_encode({:sync_update, update})
                broadcast(state, bcast)
                {:ok, state}
              else
                {{:error, :permission_denied}, state}
              end

            :awareness_query ->
              {:ok, update} = encode_awareness_update(aware)
              {:ok, reply} = message_encode({:awareness_update, update})
              send(caller, {:send, reply})
              {:ok, state}

            {:awareness_update, update} ->
              state =
                with {:ok, user_id} <- Map.fetch(meta, :user),
                     {:ok, update_map} <- awareness_update_to_map(update),
                     [{_client, {_clock, json}}] <- Map.to_list(update_map),
                     {:ok, json} when is_map(json) <- Jason.decode(json),
                     {:ok, view_at} <- Map.fetch(json, "viewAt") do
                  %{state | user_view_ats: Map.put(state.user_view_ats, user_id, view_at)}
                else
                  _ ->
                    state
                end

              :ok = apply_awareness_update(aware, update)
              {:ok, bcast} = message_encode({:awareness_update, update})
              broadcast(state, bcast)
              {:ok, state}

            msg ->
              Logger.debug("Unhandled msg: #{inspect(msg)}")
              {:ok, state}
          end

        {:reply, reply, bump_timeout(state)}

      :error ->
        {:reply, {:error, :not_connected}, state}
    end

    {:reply, :ok, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, caller, _reason}, state) do
    if Map.has_key?(state.sockets, caller) do
      state = Map.update!(state, :sockets, &Map.delete(&1, caller))
      Logger.info("Disconnected #{inspect(caller)} from #{state.map}")
      {:noreply, state}
    else
      {:noreply, state}
    end
  end

  @impl true
  def handle_info(:timeout, state) do
    if map_size(state.sockets) == 0 do
      Logger.info("Stopping engine for #{state.map} as no connected sockets for timeout")
      {:stop, :normal, state}
    else
      {:noreply, state}
    end
  end

  @impl true
  def handle_info(:snapshot, state) do
    save_state(state, true)
    {:noreply, state}
  end

  @impl true
  def handle_info({ref, :task_ok}, state) when is_reference(ref) do
    {:noreply, state}
  end

  @impl true
  def handle_info({ref, {:error, err}}, state) when is_reference(ref) do
    Logger.error("Async task failed: #{inspect(err)}")
    {:stop, err, state}
  end

  defp bump_timeout(state) do
    Map.update(state, :timeout_timer, nil, fn old ->
      if old, do: Process.cancel_timer(old)
      Process.send_after(self(), :timeout, @timeout_millis)
    end)
  end

  defp broadcast(state, data) do
    for peer <- Map.keys(state.sockets) do
      send(peer, {:send, data})
    end
  end

  defp initial_view_at_msg(value) do
    json =
      Jason.encode!(%{
        center: [value.center_lng, value.center_lat],
        zoom: value.zoom,
        pitch: value.pitch,
        bearing: value.bearing
      })

    {:custom, @initial_view_at_tag, json}
  end

  defp save_state(state, async?) do
    aware = state.aware
    map_id = state.map

    prev_snapshot_snapshot = Maps.get_last_snapshot_snapshot(map_id)

    # Note that we can't lock aware asyncronously
    map_task =
      case serialize_snapshot_if_changed(aware, prev_snapshot_snapshot) do
        {:error, error} ->
          Logger.error("Failed to snapshot state: #{inspect(error)}")
          nil

        {:ok, nil} ->
          nil

        {:ok, snapshot_snapshot} ->
          {:ok, as_update} = encode_state_as_update(aware, nil)
          {:ok, data} = serialize_data(aware)

          attrs = %{
            map_id: map_id,
            snapshot: snapshot_snapshot,
            as_update: as_update,
            data: data,
            snapshot_at: DateTime.utc_now()
          }

          run_task(fn ->
            attrs = Map.update!(attrs, :data, &Jason.decode!/1)
            {:ok, _} = Maps.save_snapshot(attrs)
          end)
      end

    view_at_tasks =
      for {user_id, view_at} <- state.user_view_ats do
        run_task(fn ->
          {:ok, _} = Maps.update_view_at(user_id, map_id, view_at)
        end)
      end

    if !async? do
      [map_task | view_at_tasks]
      |> Enum.filter(&(!is_nil(&1)))
      |> Task.await_many()
    end
  end

  defp run_task(fun) do
    Task.Supervisor.async(PlanTopo.TaskSupervisor, fn ->
      fun.()
      :task_ok
    end)
  end
end
