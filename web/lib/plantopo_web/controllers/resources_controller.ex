defmodule PlanTopoWeb.ResourcesController do
  use PlanTopoWeb, :controller

  def index(conn, _) do
    value = PlanTopo.Resources.value()

    conn
    |> put_resp_content_type("application/json")
    |> resp(200, value)
  end
end
