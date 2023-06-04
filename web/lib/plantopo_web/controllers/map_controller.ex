defmodule PlanTopoWeb.MapController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Maps
  alias PlanTopoWeb.MapJSON

  def show(conn, %{"id" => map_id}) do
    user = conn.assigns.current_user
    {:allow, sync_token} = Maps.mint_sync_token!(map_id, user)

    render(conn, :show,
      layout: false,
      map_app: true,
      tokens: MapJSON.tokens(),
      sync_token: sync_token,
      map_id: map_id
    )
  end
end
