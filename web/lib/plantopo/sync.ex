defmodule PlanTopo.Sync do
  require Logger
  alias PlanTopo.Sync.Manager

  @type engine :: pid()
  @type client_id :: number()

  # one day in secons
  @user_token_max_age 86400

  @config Application.compile_env!(:plantopo, __MODULE__)
  @socket_host Keyword.fetch!(@config, :host)
  @secret_key_base Keyword.fetch!(@config, :secret_key_base)

  @spec socket_url(map :: number()) :: String.t()
  def socket_url(map_id) do
    "wss://#{@socket_host}/api/map_sync?id=#{map_id}"
  end

  @doc """
  Mint a token authenticating a user for the purpose of authenticating a sync
  session.
  """
  @spec mint_user_token(PlanTopo.Accounts.User.t()) :: binary()
  def mint_user_token(%PlanTopo.Accounts.User{id: id}) do
    Phoenix.Token.sign(@secret_key_base, "user_token", %{user_id: id})
  end

  def verify_user_token_if_present(token) do
    if is_nil(token) do
      {:ok, nil}
    else
      with {:ok, %{user_id: id}} <-
             Phoenix.Token.verify(@secret_key_base, "user_token", token,
               max_age: @user_token_max_age
             ) do
        {:ok, id}
      else
        _ ->
          {:error, :unauthorized}
      end
    end
  end

  @spec connect(number()) :: {:ok, client_id(), engine()} | {:error, term()}
  def connect(map_id) do
    with {:ok, client_id, engine} <- GenServer.call(Manager, {:connect, map_id}) do
      Process.link(engine)
      {:ok, client_id, engine}
    end
  end

  @spec recv(engine(), number(), any()) :: :ok
  def recv(engine, client_id, msg) do
    GenServer.call(engine, {:recv, client_id, msg})
  end

  def mint_server_snapshot_token do
    Phoenix.Token.sign(@secret_key_base, "server_snapshot_token", :v1)
  end

  def verify_server_snapshot_token!(token) do
    with {:ok, :v1} <-
           Phoenix.Token.verify(
             @secret_key_base,
             "server_snapshot_token",
             token,
             max_age: :infinity
           ) do
      nil
    else
      error ->
        Logger.info("Unexpected result of verifying server snapshot token: #{inspect(error)}")
        raise PlanTopo.ForbiddenError, "Invalid server snapshot token"
    end
  end
end
