defmodule PlanTopoWeb.MapController do
  use PlanTopoWeb, :controller

  def index(conn, _params) do
    render(conn, :index,
      layout: false,
      extra_scripts: [~p(/assets/map.js)],
      extra_stylesheets: [~p(/assets/map.css)]
    )
  end
end
