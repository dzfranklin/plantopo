defmodule PlanTopo.Sync.Engine do
  use GenServer

  require Logger

  @bin Application.compile_env(:plantopo, :sync_engine)

  # 8 MiB
  @max_line 8 * 2 ** 20

  defmodule State do
    defstruct [:engine, :clients]
  end

  # TODO: Compaction?
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
          {:env, [{String.to_charlist("RUST_LOG"), String.to_charlist("debug")}]}
        ]
      )

    Port.command(engine, [Integer.to_string(id), "\n"])

    {:ok, %State{engine: engine, clients: BiMap.new()}}
  end

  @impl true
  def handle_call({:connect, {client_id, client_pid}}, _from, state) do
    Process.monitor(client_pid)
    state = %{state | clients: BiMap.put(state.clients, client_id, client_pid)}
    {:reply, :ok, state}
  end

  @impl true
  def handle_call({:recv, client_id, msg}, _from, state) do
    command = Jason.encode!(%{client: client_id, msg: msg})
    send(state.engine, {self(), {:command, [command, "\n"]}})
    {:reply, :ok, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    {:noreply, %{state | clients: BiMap.delete_value(state.clients, pid)}}
  end

  @impl true
  def handle_info({engine, {:data, line}}, state) when engine == state.engine do
    line =
      case line do
        {:eol, line} ->
          line

        {:noeol, _} ->
          raise "PlanTopo.Sync.Engine received greater than @max_line"
      end

    case Jason.decode!(line) do
      %{"Err" => err} ->
        %{
          "reply_to" => reply_to_id,
          "message" => message
        } = err

        if is_nil(reply_to_id) do
          Logger.warn(
            "PlanTopo.Sync.Engine: Engine returned general error, exiting: #{inspect(message)}"
          )

          {:stop, {:general_error, message}, state}
        else
          msg =
            %{
              error: "Internal sync engine error",
              details: message
            }
            |> Jason.encode!()

          reply_to = BiMap.get(state.clients, reply_to_id)
          send(reply_to, {self(), :send, msg})

          Logger.info(
            "Replied with error: #{inspect(%{reply_to_id: reply_to_id, reply_to: reply_to, message: message})}"
          )

          {:noreply, state}
        end

      %{
        "Ok" => ok
      } ->
        %{
          "reply_to" => reply_to_id,
          "seq" => seq,
          "changeset" => %{"reply" => reply, "bcast" => bcast}
        } = ok

        reply =
          %{
            reply_to: seq,
            change: reply
          }
          |> Jason.encode!()

        bcast = Jason.encode!(%{change: bcast})

        reply_to = BiMap.get(state.clients, reply_to_id)

        send(reply_to, {self(), :send, reply})

        state.clients
        |> Enum.filter(fn {client_id, _} -> client_id != reply_to_id end)
        |> Enum.each(fn {_, client_pid} -> send(client_pid, {self(), :send, bcast}) end)

        {:noreply, state}
    end
  end
end
