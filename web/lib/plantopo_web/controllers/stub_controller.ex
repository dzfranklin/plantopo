defmodule PlanTopoWeb.StubController do
  @moduledoc """
  Used as a stub for routes handled by the frontend app
  """
  use PlanTopoWeb, :controller

  def stub(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, "stub")
  end
end
