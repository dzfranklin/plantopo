defmodule PlanTopoWeb.ReportLayerDataRequestsController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Reports

  action_fallback PlanTopoWeb.FallbackController

  def post(conn, %{"user" => user, "requests" => requests}) do
    Reports.insert_layer_data_requests!(user, requests)
    send_resp(conn, 200, "ok\n")
  end
end
