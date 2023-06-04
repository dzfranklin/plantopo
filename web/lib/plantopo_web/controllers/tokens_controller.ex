defmodule PlanTopoWeb.TokensController do
  use PlanTopoWeb, :controller

  def index(conn, _) do
    value = PlanTopo.Accounts.frontend_tokens_for(conn.assigns.current_user)
    render(conn, :index, value: value)
  end
end
