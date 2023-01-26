defmodule PlanTopoWeb.MapController do
  use PlanTopoWeb, :controller

  def index(conn, _params) do
    render(conn, :index,
      layout: false,
      extra_scripts: [
        ~p(/assets/map.js),
        "https://labs.os.uk/public/os-api-branding/v0.3.1/os-api-branding.js"
      ],
      extra_stylesheets: [
        ~p(/assets/map.css),
        "https://labs.os.uk/public/os-api-branding/v0.3.1/os-api-branding.css"
      ]
    )
  end
end
