defmodule PlanTopoWeb.SyncSocket do
  @behaviour :cowboy_websocket
  alias PlanTopo.Sync
  alias PlanTopo.Maps
  require Logger

  defmodule State do
    defstruct [:map_id, :session_id, :can_edit, :maybe_user_id, :engine]
  end

  @impl true
  def init(req, _opts) do
    %{id: map_id} = :cowboy_req.match_qs([{:id, :int}], req)

    state = %State{
      map_id: map_id,
      can_edit: false,
      # All nil until authed
      session_id: nil,
      maybe_user_id: nil,
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
  def websocket_handle({:text, input}, state) when is_nil(state.session_id) do
    %{"type" => "auth"} = req = Jason.decode!(input)
    {:ok, maybe_user_id} = Sync.verify_user_token_if_present(req["token"])

    meta = Maps.get_meta!(state.map_id)
    can_edit = Maps.check_authorized(maybe_user_id, meta, :edit) == :ok
    if not can_edit, do: Maps.check_authorized!(maybe_user_id, meta, :view)

    {:ok, session_id, engine} = Sync.connect(state.map_id)

    {[],
     %{
       state
       | session_id: session_id,
         maybe_user_id: maybe_user_id,
         can_edit: can_edit,
         engine: engine
     }}
  end

  @impl true
  def websocket_handle({:text, msg}, state) do
    msg = Jason.decode!(msg)

    case Map.fetch!(msg, "type") do
      "keepalive" ->
        {[], state}

      "op" ->
        if state.can_edit do
          :ok = Sync.recv(state.engine, state.session_id, msg)
          {[], state}
        else
          {[{:close, "received op from read-only session"}], state}
        end
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
