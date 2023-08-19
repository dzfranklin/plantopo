defmodule PlanTopo.Sync.Engine do
  use GenServer

  require Logger

  @bin Application.compile_env(:plantopo, :sync_engine)

  # 8 MiB
  @max_line 8 * 2 ** 20

  defmodule State do
    @type clients :: BiMap.t(integer(), pid())

    @type t :: %__MODULE__{
            engine: port(),
            clients: clients(),
            next_client: integer()
          }

    defstruct [
      :engine,
      :clients,
      :next_client
    ]
  end

  # TODO: Auto-close

  @impl true
  def init(opts) do
    id = Keyword.fetch!(opts, :map_id)

    engine =
      Port.open(
        {:spawn_executable, @bin},
        [
          :binary,
          {:args, []},
          {:line, @max_line},
          {:env, [{String.to_charlist("RUST_LOG"), String.to_charlist("trace")}]},
          :exit_status
        ]
      )

    send_engine(engine, %{"action" => "open", "map" => id})

    {:ok, %State{engine: engine, clients: BiMap.new(), next_client: 0}}
  end

  @impl true
  def handle_call({:connect, client_pid}, _from, state) do
    cid = state.next_client
    Process.monitor(client_pid)
    state = %{state | clients: BiMap.put(state.clients, cid, client_pid), next_client: cid + 1}
    send_engine(state.engine, %{"action" => "connect", "id" => cid})
    {:reply, {:ok, cid}, state}
  end

  @impl true
  def handle_call({:recv, client_id, msg}, _from, state) do
    send_engine(state.engine, %{"action" => "recv", "id" => client_id, "value" => msg})
    {:reply, :ok, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    {:noreply, %{state | clients: BiMap.delete_value(state.clients, pid)}}
  end

  @impl true
  def handle_info({engine, {:exit_status, status}}, state) when engine == state.engine do
    raise "Engine process exited unexpectedly with status #{status}"
  end

  @impl true
  def handle_info({engine, {:data, line}}, state) when engine == state.engine do
    {:eol, line} = line

    case Jason.decode!(line) do
      %{
        "id" => cid,
        "action" => "connect",
        "fid_block_start" => fid_block_start,
        "fid_block_until" => fid_block_until,
        "state" => map_state
      } ->
        # Matches ConnectAcceptMsg in app/src/sync/socketMessages.ts
        send_client(state.clients, cid, %{
          type: "connectAccept",
          fidBlockStart: fid_block_start,
          fidBlockUntil: fid_block_until,
          state: map_state
        })

        {:noreply, state}

      %{
        "action" => "send",
        "id" => cid,
        "recv_seq" => seq,
        "reply" => reply,
        "bcast" => bcast
      } ->
        # Matches ReplyMsg in app/src/sync/socketMessages.ts
        send_client(state.clients, cid, %{type: "reply", replyTo: seq, change: reply})

        if !is_nil(bcast) do
          # Matches BcastMsg in app/src/sync/socketMessages.ts
          send_bcast(state.clients, cid, %{type: "bcast", change: bcast})
        end

        {:noreply, state}

      %{
        "action" => "send_error",
        "recv_id" => client_id,
        "error" => error,
        "details" => details
      } ->
        # Matches ErrorMsg in app/src/sync/socketMessages.ts
        send_client(state.clients, client_id, %{type: "error", error: error, details: details})

        {:noreply, state}
    end
  end

  @impl true
  def handle_info(msg, state) do
    Logger.info("Unhandled handle_info in Engine: #{inspect(msg)}")
    {:noreply, state}
  end

  defp send_engine(engine, input) do
    input = Jason.encode!(input)
    send(engine, {self(), {:command, [input, "\n"]}})
    nil
  end

  defp send_client(clients, client_id, msg) do
    msg = Jason.encode!(msg)
    pid = BiMap.get(clients, client_id)
    send(pid, {self(), :send, msg})
    nil
  end

  defp send_bcast(clients, except, msg) do
    msg = Jason.encode!(msg)

    for {cid, pid} <- clients do
      if cid != except do
        send(pid, {self(), :send, msg})
      end
    end
  end
end
