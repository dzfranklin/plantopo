defmodule PlanTopoWeb.ReportTileLoadsController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Reports

  action_fallback PlanTopoWeb.FallbackController

  def post(conn, %{"user" => user, "requests" => requests}) do
    Reports.report_tile_loads!(user, requests)
    send_resp(conn, 200, "ok\n")
  end
end
