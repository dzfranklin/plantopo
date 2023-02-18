defmodule PlanTopoWeb.MapController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Maps
  alias PlanTopoWeb.MapApiJSON

  def show(conn, %{"id" => map_id}) do
    user = conn.assigns.current_user
    map = Maps.get_map!(user, map_id)
    view = Maps.get_view_full!(user, map.view_id)
    view_at = Maps.get_view_at(user, map_id, conn.remote_ip)

    layer_sources =
      view.layers
      |> Enum.map(& &1.source)

    layer_sources = Enum.into(layer_sources, %{}, &{&1.id, MapApiJSON.view_layer_source(&1)})

    data_sources =
      view.layers
      |> Enum.flat_map(& &1.source.dependencies)
      |> Enum.into(
        %{},
        &{&1.id, MapApiJSON.view_data_source(&1)}
      )

    preloaded_state = %{
      map: %{
        tokens: MapApiJSON.tokens(),
        map: %{
          id: map.id,
          viewAt: MapApiJSON.view_at(view_at),
          viewDataSources: data_sources,
          viewLayerSources: layer_sources,
          view: MapApiJSON.view(view),
          features: map.features
        },
        viewEditor: %{
          state: "closed"
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
