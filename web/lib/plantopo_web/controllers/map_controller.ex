defmodule PlanTopoWeb.MapController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Maps
  alias PlanTopoWeb.MapApiJSON

  def show(conn, %{"id" => map_id}) do
    user = conn.assigns.current_user
    map = Maps.get_map!(user, map_id)
    view_at = Maps.get_view_at(user, map_id, conn.remote_ip)
    layer_sources = Maps.list_view_layer_sources(user)
    data_sources = Maps.list_view_data_sources(user)

    preloaded_state = %{
      map: %{
        tokens: MapApiJSON.tokens(),
        viewDataSources: MapApiJSON.data_sources(data_sources),
        viewLayerSources: MapApiJSON.layer_sources(layer_sources),
        map: MapApiJSON.map(map),
        viewAt: MapApiJSON.view_at(view_at),
        geolocation: %{
          updating: false
        }
      }
    }

    render(conn, :show,
      layout: false,
      map_app: true,
      preloaded_state: preloaded_state
    )
  end
end
