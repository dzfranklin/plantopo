defmodule PlanTopoWeb.SyncSocket do
  @behaviour :cowboy_websocket
  alias PlanTopo.Sync
  require Logger

  defmodule State do
    defstruct [:map_id, :client_id, :engine]
  end

  @impl true
  def init(req, _opts) do
    %{id: map_id} = :cowboy_req.match_qs([{:id, :int}], req)

    state = %State{
      map_id: map_id,
      client_id: nil,
      # Do not connect until authed
      engine: nil
    }

    {:cowboy_websocket, req, state}
  end

  @impl true
  def terminate(reason, _preq, state) do
    Logger.debug("sync_socket terminated: #{inspect(reason)} #{inspect(state)}")
    :ok
  end

  @impl true
  def websocket_init(state), do: {[], state}

  @impl true
  def websocket_handle({:text, input}, state) when is_nil(state.client_id) do
    # We haven't authenticated yet

    %{"token" => token} = Jason.decode!(input)

    {:ok, client_id, engine} =
      Sync.connect(%{
        map_id: state.map_id,
        token: token
      })

    state = %{state | client_id: client_id, engine: engine}

    {[], state}
  end

  @impl true
  def websocket_handle({:text, msg}, state) do
    msg = Jason.decode!(msg)

    case Map.fetch!(msg, "type") do
      "keepalive" ->
        {[], state}

      "op" ->
        :ok = Sync.recv(state.engine, state.client_id, msg)
        {[], state}
    end
  end

  @impl true
  def websocket_info({engine, :send, msg}, state) when engine == state.engine do
    {[{:text, msg}], state}
  end

  @impl true
  def websocket_info({:EXIT, engine, reason}, state) when engine == state.engine do
    # Matches ErrorMsg in app/src/socketMessages.ts
    msg =
      %{
        type: "error",
        error: "Unexpected engine exit",
        details: inspect(reason)
      }
      |> Jason.encode!()

    {[{:text, msg}, :close], state}
  end

  @impl true
  def websocket_info(msg, state) do
    Logger.info("Unhandled websocket_info: #{inspect(msg)}")
    {[], state}
  end
end
