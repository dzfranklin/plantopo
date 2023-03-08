defmodule PlanTopoWeb.MapController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Maps
  alias PlanTopoWeb.MapJSON

  def show(conn, %{"id" => map_id}) do
    user = conn.assigns.current_user
    layer_sources = Maps.list_layer_sources(user)
    layer_datas = Maps.list_layer_datas(user)

    render(conn, :show,
      layout: false,
      map_app: true,
      tokens: MapJSON.tokens(),
      layer_datas: MapJSON.layer_datas(layer_datas),
      layer_sources: MapJSON.layer_sources(layer_sources),
      map_id: map_id
    )
  end
end
