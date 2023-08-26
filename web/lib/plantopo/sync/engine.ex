defmodule PlanTopo.Sync.Engine do
  use GenServer

  require Logger

  @config Application.compile_env(:plantopo, :sync_engine)
  @executable Keyword.fetch!(@config, :executable) |> String.to_charlist()
  @store Keyword.fetch!(@config, :store) |> String.to_charlist()
  @log_level Keyword.fetch!(@config, :log_level) |> String.to_charlist()
  @close_timeout Keyword.get(@config, :close_timeout, 30_000)

  # 8 MiB
  @max_line 8 * 2 ** 20

  defmodule State do
    @type sessions :: BiMap.t(integer(), pid())

    @type t :: %__MODULE__{
      map_id: number(),
            engine: port(),
            sessions: sessions(),
            next_session_id: integer(),
            idle_timer: reference()
          }

    defstruct [
      :map_id,
      :engine,
      :sessions,
      :next_session_id,
      :idle_timer
    ]
  end

  @impl true
  def init(opts) do
    map_id = Keyword.fetch!(opts, :map_id)

    idle_timer = Process.send_after(self(), :close_timeout, @close_timeout)

    engine =
      Port.open(
        {:spawn_executable, @executable},
        [
          :binary,
          {:args, ['--store', @store, '--map-id', to_charlist(map_id)]},
          {:line, @max_line},
          {:env, [{'RUST_LOG', @log_level}]},
          :exit_status
        ]
      )

    {:ok, %State{map_id: map_id, engine: engine, sessions: BiMap.new(), next_session_id: 0, idle_timer: idle_timer}}
  end

  defp reset_idle_timer(state) do
    _ = Process.cancel_timer(state.idle_timer)
    timer = Process.send_after(self(), :close_timeout, @close_timeout)
    %{state | idle_timer: timer}
  end

  @impl true
  def handle_call({:connect, client_pid}, _from, state) do
    session_id = state.next_session_id
    Process.monitor(client_pid)

    state = %{
      state
      | sessions: BiMap.put(state.sessions, session_id, client_pid),
        next_session_id: session_id + 1
    } |> reset_idle_timer()

    send_engine(state.engine, %{
      "action" => "connect",
      "id" => session_id
    })

    {:reply, {:ok, session_id}, state}
  end

  @impl true
  def handle_call({:recv, client_id, msg}, _from, state) do
    send_engine(state.engine, %{"action" => "recv", "id" => client_id, "value" => msg})
    {:reply, :ok, state |> reset_idle_timer()}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    {:noreply, %{state | sessions: BiMap.delete_value(state.sessions, pid)}}
  end

  @impl true
  def handle_info({engine, {:exit_status, status}}, state) when engine == state.engine do
    raise "Engine (map #{state.map_id}) process exited unexpectedly with status #{status}"
  end

  @impl true
  def handle_info({engine, {:data, line}}, state) when engine == state.engine do
    {:eol, line} = line
    state = state |> reset_idle_timer()

    case Jason.decode!(line) do
      %{
        "id" => session_id,
        "action" => "connect",
        "fid_block_start" => fid_block_start,
        "fid_block_until" => fid_block_until,
        "state" => map_state
      } ->
        # Matches ConnectAcceptMsg in app/src/sync/socketMessages.ts
        send_client(state.sessions, session_id, %{
          type: "connectAccept",
          sessionId: session_id,
          fidBlockStart: fid_block_start,
          fidBlockUntil: fid_block_until,
          state: map_state
        })

        {:noreply, state}

      %{
        "action" => "send",
        "id" => session_id,
        "recv_seq" => seq,
        "reply" => reply,
        "bcast" => bcast
      } ->
        # Matches ReplyMsg in app/src/sync/socketMessages.ts
        send_client(state.sessions, session_id, %{type: "reply", replyTo: seq, change: reply})

        if !is_nil(bcast) do
          # Matches BcastMsg in app/src/sync/socketMessages.ts
          send_bcast(state.sessions, session_id, %{type: "bcast", change: bcast})
        end

        {:noreply, state}

      %{
        "action" => "send_error",
        "id" => session_id,
        "error" => error,
        "details" => details
      } ->
        # Matches ErrorMsg in app/src/sync/socketMessages.ts
        send_client(state.sessions, session_id, %{type: "error", error: error, details: details})

        {:noreply, state}
    end
  end

  @impl true
  def handle_info(:close_timeout, state) do
    Logger.info("Engine closing as idle (map #{state.map_id})")
     {:stop, :idle}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.info("Unhandled handle_info in Engine (map #{state.map_id}): #{inspect(msg)}")
    {:noreply, state}
  end

  defp send_engine(engine, input) do
    input = Jason.encode!(input)
    send(engine, {self(), {:command, [input, "\n"]}})
    nil
  end

  @spec send_client(State.sessions(), number(), map()) :: nil
  defp send_client(sessions, client_id, msg) do
    msg = Jason.encode!(msg)
    pid = BiMap.get(sessions, client_id)
    send(pid, {self(), :send, msg})
    nil
  end

  @spec send_bcast(State.sessions(), number(), map()) :: nil
  defp send_bcast(sessions, except, msg) do
    msg = Jason.encode!(msg)

    sessions
    |> Enum.filter(fn {p, _} -> p != except end)
    |> Enum.each(fn {_, pid} -> send(pid, {self(), :send, msg}) end)

    nil
  end
end
