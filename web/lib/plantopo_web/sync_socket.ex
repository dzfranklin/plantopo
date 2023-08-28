defmodule PlanTopoWeb.SyncSocket do
  @behaviour :cowboy_websocket
  alias PlanTopo.Sync
  alias PlanTopo.Maps
  require Logger

  @keepalive_interval 10 * 1000
  @no_keepalive_timeout 5 * 60 * 1000
  @close_invalid 1008
  @close_normal 1000
  @close_internal_error 1011

  defmodule State do
    defstruct [:map_id, :no_keepalive_timer, :session_id, :can_edit, :maybe_user_id, :engine]
  end

  @impl true
  def init(req, _opts) do
    %{id: map_id} = :cowboy_req.match_qs([{:id, :int}], req)

    state = %State{
      map_id: map_id,
      no_keepalive_timer: nil,
      can_edit: false,
      # All nil until authed
      session_id: nil,
      maybe_user_id: nil,
      engine: nil
    }

    {:cowboy_websocket, req, state}
  end

  @impl true
  def websocket_init(state) do
    Process.send_after(self(), :send_keepalive, @keepalive_interval)
    {[], reset_no_keepalive_timer(state)}
  end

  defp reset_no_keepalive_timer(state) do
    _ = if !is_nil(state.no_keepalive_timer), do: Process.cancel_timer(state.no_keepalive_timer)
    timer = Process.send_after(self(), :no_keepalive_timeout, @no_keepalive_timeout)
    %{state | no_keepalive_timer: timer}
  end

  @impl true
  def terminate(reason, _preq, state) do
    Logger.debug("sync_socket terminated: #{inspect(reason)} #{inspect(state)}")
    :ok
  end

  @impl true
  def websocket_handle({:text, input}, state) when is_nil(state.session_id) do
    state = reset_no_keepalive_timer(state)
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
    state = reset_no_keepalive_timer(state)
    msg = Jason.decode!(msg)

    case Map.fetch!(msg, "type") do
      "keepalive" ->
        {[], state}

      "op" ->
        if state.can_edit do
          :ok = Sync.recv(state.engine, state.session_id, msg)
          {[], state}
        else
          {[{:close, @close_invalid, "received op from read-only session"}], state}
        end
    end
  end

  @impl true
  def websocket_info(:no_keepalive_timeout, state) do
    {[
       {:close, @close_normal, "Received no messages for #{@no_keepalive_timeout}ms"}
     ], state}
  end

  @impl true
  def websocket_info(:send_keepalive, state) do
    Process.send_after(self(), :send_keepalive, @keepalive_interval)

    {[
       {:text, Jason.encode!(%{"type" => "keepalive"})}
     ], state}
  end

  @impl true
  def websocket_info({engine, :send, msg}, state) when engine == state.engine do
    {[{:text, msg}], state}
  end

  @impl true
  def websocket_info({:EXIT, engine, reason}, state) when engine == state.engine do
    {[
       {:close, @close_internal_error, "Unexpected engine exit"},
       {:shutdown_reason, reason}
     ], state}
  end

  @impl true
  def websocket_info(msg, state) do
    Logger.info("Unhandled websocket_info: #{inspect(msg)}")
    {[], state}
  end
end
