defmodule PlanTopoWeb.OSProxy do
  import Plug.Conn
  alias PlanTopoWeb.Endpoint
  require Logger

  def init(_) do
    config = Application.fetch_env!(:plantopo, __MODULE__)
    [rewrite_to: Keyword.fetch!(config, :rewrite_to) |> URI.parse()]
  end

  def call(conn, opts) do
    case conn.method do
      "OPTIONS" ->
        conn
        |> put_cors_headers()
        |> send_resp(204, "")

      "GET" ->
        conn = fetch_query_params(conn)

        {auth, conn} = take_auth(conn)

        if auth != "todo" do
          raise "Auth fail"
        end

        rewrite_to = Keyword.fetch!(opts, :rewrite_to)
        reply = PlanTopo.OSProxy.fetch(conn.request_path, conn.query_params, rewrite_to)

        conn
        |> put_cors_headers()
        |> put_resp_content_type(reply.content_type)
        |> maybe_put_content_encoding(reply)
        |> send_resp(reply.status, reply.body)
    end
  end

  defp take_auth(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> auth] ->
        {auth, delete_req_header(conn, "authorization")}

      [] ->
        {auth, query} = Map.pop(conn.query_params, "plantopoKey")
        {auth, %Plug.Conn{conn | query_params: query}}
    end
  end

  defp maybe_put_content_encoding(conn, reply) do
    encoding = Map.get(reply, :content_encoding)

    if is_nil(encoding),
      do: conn,
      else: put_resp_header(conn, "content-encoding", encoding)
  end

  defp put_cors_headers(conn) do
    conn
    |> put_resp_header("access-control-allow-methods", "OPTIONS, GET")
    |> put_resp_header("access-control-allow-headers", "Authorization")
    |> put_resp_header("access-control-allow-origin", Endpoint.url())
    |> put_resp_header("access-control-max-age", "86400")
    |> put_resp_header("cache-control", "public, max-age=86400")
    |> put_resp_header("vary", "Origin")
  end
end
