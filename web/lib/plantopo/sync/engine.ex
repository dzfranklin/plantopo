defmodule PlanTopo.Sync.Engine do
  @moduledoc """
  Manages the synchronization of a single map
  """
  use GenServer, restart: :temporary
  require Logger

  defp config, do: Application.fetch_env!(:plantopo, __MODULE__)

  def start_link(map, opts \\ config()) do
    opts = Keyword.put(opts, :map, map)
    GenServer.start_link(__MODULE__, opts)
  end

  @impl true
  def init(opts) do
    map = Keyword.fetch!(opts, :map)
    port = Keyword.fetch!(opts, :cmd) |> open_port(map)

    state = %{
      map: map,
      port: port,
      sockets: BiMap.new(),
      exit_timeout: Keyword.fetch!(opts, :exit_timeout_millis),
      next_id: 0
    }

    Logger.info("Created engine [map=#{inspect(map)}]")

    {:ok, state, state.exit_timeout}
  end

  @impl true
  def handle_call({:connect, %{meta: meta, fallback_center: fallback_center}}, {caller, _}, state) do
    if BiMap.has_key?(state.sockets, caller) do
      {:reply, {:error, :already_connected}, state}
    else
      id = state.next_id

      state = %{
        state
        | sockets: BiMap.put(state.sockets, caller, id),
          next_id: id + 1
      }

      Process.monitor(caller)

      send_cmd(
        state,
        {:connect,
         %{
           socket: id,
           meta: meta,
           fallback_center: fallback_center
         }}
      )

      Logger.info(
        "Connected #{inspect(caller)} to #{state.map} as #{inspect(meta)} [fallback_center=#{inspect(fallback_center)}]"
      )

      {:reply, :ok, state, state.exit_timeout}
    end
  end

  @impl true
  def handle_call({:recv, msg}, {caller, _}, state) do
    case fetch_socket_id(state, caller) do
      {:ok, id} ->
        send_cmd(state, {:recv, {id, msg}})
        {:reply, :ok, state, state.exit_timeout}

      :error ->
        {:reply, {:error, :not_connected}, state, state.exit_timeout}
    end
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, caller, _reason}, state) do
    case fetch_socket_id(state, caller) do
      {:ok, id} ->
        send_cmd(state, {:leave, id})
        state = Map.update!(state, :sockets, &BiMap.delete(&1, caller, id))
        Logger.info("Disconnected #{inspect(caller)} from #{state.map}")
        {:noreply, state, state.exit_timeout}

      :error ->
        {:stop, :unexpected_down, state.exit_timeout}
    end
  end

  @impl true
  def handle_info(:timeout, state) do
    if BiMap.size(state.sockets) == 0 do
      Logger.info("Stopping engine for #{state.map} as no connected sockets for timeout")
      {:stop, :normal, state}
    else
      {:noreply, state, state.exit_timeout}
    end
  end

  @impl true
  def handle_info({port, msg}, state) when is_port(port) do
    if port == state.port do
      case msg do
        {:data, msg} ->
          msg = :erlang.binary_to_term(msg)
          handle_port(msg, state)

        {:exit_status, status} ->
          Logger.error("Nonezero exit status: #{status}")
          {:stop, :port_exit, state}
      end
    else
      {:noreply, state, state.exit_timeout}
    end
  end

  def handle_port({:send, {id, msg}}, state) do
    case fetch_socket_pid(state, id) do
      {:ok, pid} -> send(pid, {:sync, :send, msg})
      :error -> nil
    end

    {:noreply, state, state.exit_timeout}
  end

  def handle_port({:broadcast, msg}, state) do
    for pid <- BiMap.keys(state.sockets) do
      send(pid, {:sync, :send, msg})
    end

    {:noreply, state, state.exit_timeout}
  end

  defp open_port(bin, map_id) do
    Port.open({:spawn_executable, bin}, [
      {:args, [map_id]},
      {:packet, 4},
      :nouse_stdio,
      :binary,
      :exit_status
    ])
  end

  defp send_cmd(state, cmd) do
    Port.command(state.port, :erlang.term_to_binary(cmd))
  end

  defp fetch_socket_id(state, pid) do
    BiMap.fetch(state.sockets, pid)
  end

  defp fetch_socket_pid(state, id) do
    BiMap.fetch_key(state.sockets, id)
  end
end
