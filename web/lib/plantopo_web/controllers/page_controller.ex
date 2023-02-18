defmodule PlanTopoWeb.PageController do
  use PlanTopoWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
