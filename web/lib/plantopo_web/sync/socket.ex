defmodule PlanTopoWeb.Sync.Socket do
  @behaviour :cowboy_websocket
  require Logger
  alias PlanTopo.{Sync, Accounts, Maps}

  @session_options Application.compile_env!(:plantopo, :session_options)
  @session_signing_salt Keyword.fetch!(@session_options, :signing_salt)
  @session_key Keyword.fetch!(@session_options, :key)

  @impl :cowboy_websocket
  def init(req, _opts) do
    map = req.qs
    user = get_user_or_nil(req)
    role = Maps.role(user, map)

    if role in [:viewer, :editor, :owner] do
      {:cowboy_websocket, req, [map: req.qs, meta: %{user: user.id, role: role}]}
    else
      {:error, :role}
    end
  end

  @impl :cowboy_websocket
  def websocket_init(opts) do
    map = Keyword.fetch!(opts, :map)
    meta = Keyword.fetch!(opts, :meta)

    engine = Sync.connect!(map, meta)
    Process.monitor(engine)

    {:ok, engine}
  end

  @impl :cowboy_websocket
  def websocket_handle({:ping, _}, engine), do: {:reply, :pong, engine}

  @impl :cowboy_websocket
  def websocket_handle({:binary, msg}, engine) do
    Sync.handle_recv!(engine, msg)
    {:ok, engine}
  end

  @impl true
  def websocket_info({:sync, :send, msg}, engine) do
    {:reply, {:binary, msg}, engine}
  end

  @impl true
  def websocket_info({:sync, :fatal, error}, engine) do
    Logger.warn("Stopping socket as engine reported a socket fatal error: #{inspect(error)}")
    {:stop, engine}
  end

  @impl true
  def websocket_info({:DOWN, _, _, pid2, reason}, engine) do
    if pid2 == engine do
      Logger.warn("Stopping socket as engine died: #{inspect(reason)}")
      {:stop, engine}
    else
      {:noreply, engine}
    end
  end

  defp get_user_or_nil(req) do
    with {:ok, cookie} <- Map.fetch(req.headers, "cookie"),
         cookie <- Plug.Conn.Cookies.decode(cookie),
         {:ok, session_cookie} <- Map.fetch(cookie, @session_key),
         session = verify_session!(session_cookie),
         {:ok, token} <- Map.fetch(session, "user_token") do
      Accounts.get_user_by_session_token(token)
    else
      _ -> nil
    end
  end

  defp verify_session!(cookie) do
    alias Plug.Crypto

    key_opts = [iterations: 1000, length: 32, digest: :sha256, cache: Plug.Keys]

    secret_key_base =
      Application.fetch_env!(:plantopo, PlanTopoWeb.Endpoint) |> Keyword.fetch!(:secret_key_base)

    secret = Crypto.KeyGenerator.generate(secret_key_base, @session_signing_salt, key_opts)

    {:ok, term} = Crypto.MessageVerifier.verify(cookie, secret)
    Crypto.non_executable_binary_to_term(term)
  end
end
