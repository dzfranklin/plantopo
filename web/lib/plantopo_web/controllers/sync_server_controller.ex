defmodule PlanTopoWeb.SyncServerController do
  use PlanTopoWeb, :controller
  alias PlanTopo.{Maps, Sync}
  require Logger

  action_fallback(PlanTopoWeb.FallbackController)

  def snapshot(conn, %{"map_id" => map, "value" => value}) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization") do
      Sync.verify_server_snapshot_token!(token)
    else
      _ -> raise PlanTopoWeb.InvalidRequestError, "Authorization header required"
    end

    with {:ok, _} <- Maps.save_snapshot(map, value) do
      put_status(conn, 200)
    else
      error ->
        Logger.error("Invalid map snapshot: #{inspect(error)}")
        put_status(conn, 400)
    end
  end
end
