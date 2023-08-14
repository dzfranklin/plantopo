defmodule PlanTopoWeb.SyncSocket do
  @behaviour :cowboy_websocket

  alias PlanTopo.Sync

  defmodule State do
    defstruct [:map_id, :client_id, :engine]
  end

  @impl true
  def init(req, _opts) do
    %{id: map_id} = :cowboy_req.match_qs([{:id, :int}], req)

    {:cowboy_websocket, req,
     %State{
       map_id: map_id,
       client_id: nil,
       # Do not connect until authed
       engine: nil
     }}
  end

  @impl true
  def websocket_init(state), do: {:ok, state}

  @impl true
  def websocket_handle(:ping, state), do: {:reply, :pong, state}

  @impl true
  def websocket_handle({:text, input}, state) when is_nil(state.client_id) do
    # We haven't authenticated yet

    %{"token" => token} = Jason.decode!(input)
    # TODO: Check token
    client_id = 1

    {:ok, engine} =
      Sync.connect(%{
        map_id: state.map_id,
        client_id: client_id,
        token: token
      })

    state = %{state | client_id: client_id, engine: engine}

    {:ok, state}
  end

  @impl true
  def websocket_handle({:text, msg}, state) do
    :ok = Sync.recv(state.engine, state.client_id, msg)
    {:ok, state}
  end

  @impl true
  def websocket_info({engine, :send, msg}, state)
      when not is_nil(engine) and engine == state.engine do
    {:reply, msg, state}
  end
end
