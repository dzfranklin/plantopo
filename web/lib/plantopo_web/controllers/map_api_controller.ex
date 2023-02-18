defmodule PlanTopoWeb.MapApiController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Maps

  action_fallback PlanTopoWeb.FallbackController

  def set_view_at(conn, %{"id" => map_id, "data" => data}) do
    map_id = String.to_integer(map_id)
    Maps.set_view_at!(conn.assigns.current_user, map_id, data)
    send_resp(conn, :no_content, "")
  end

  def save_view(conn, %{"data" => data}) do
    user = conn.assigns.current_user
    id = Map.get(data, "id")

    view =
      if Map.get(data, "id") do
        Maps.update_view(user, id, data)
      else
        Maps.create_view(user, data)
      end

    with {:ok, view} <- view do
      render(conn, :show_view, view: view)
    end
  end

  def list_view_sources(conn, params) do
    user = conn.assigns.current_user

    known_layer_sources =
      with {:ok, json} <- Map.fetch(params, "knownLayerSources") do
        Jason.decode!(json)
      else
        :error -> []
      end

    known_data_sources =
      with {:ok, json} <- Map.fetch(params, "knownDataSources") do
        Jason.decode!(json)
      else
        :error -> []
      end

    layer_sources = Maps.list_view_layer_sources(user, known_layer_sources)
    data_sources = Maps.list_view_data_sources(user, known_data_sources)

    render(conn, :list_view_sources, layer_sources: layer_sources, data_sources: data_sources)
  end

  # def list_default_view(conn, params) do
  #   page = Maps.list_default_views(params["cursor"])
  #   render(conn, :view_index, page: page, next: &url(~p"/api/map/view/default?cursor=#{&1}"))
  # end

  # def list_user_view(conn, params) do
  #   page = Maps.list_views(conn.assigns.current_user, params["cursor"])
  #   render(conn, :view_index, page: page, next: &url(~p"/api/map/view/user?cursor=#{&1}"))
  # end

  # def create_user_view(conn, %{"view" => view_params}) do
  #   with {:ok, view} <- Maps.create_view(conn.assigns.current_user, view_params) do
  #     conn
  #     |> put_status(:created)
  #     |> render(:show, item: view)
  #   end
  # end

  # def update_user_view(conn, %{"id" => id, "view" => view_params}) do
  #   user = conn.assigns.current_user
  #   view = Maps.get_view!(user, id)

  #   with {:ok, view} <- Maps.update_view(user, view, view_params) do
  #     render(conn, :show, item: view)
  #   end
  # end

  # def delete_user_view(conn, %{"id" => id}) do
  #   user = conn.assigns.current_user
  #   view = Maps.get_view!(user, id)

  #   with {:ok, _} <- Maps.delete_view(user, view) do
  #     send_resp(conn, :no_content, "")
  #   end
  # end

  # def list_source(conn, _params) do
  #   {view_source, source_data} = Maps.list_sources()
  #   render(conn, :source_index, source_data: source_data, view_source: view_source)
  # end

  # def get_default_view_preview(conn, %{"id" => id, "ty" => ty}) do
  #   redirect(conn,
  #     external: Maps.view_preview_url(nil, String.to_integer(id), preview_ty_to_atom(ty))
  #   )
  # end

  # def get_user_view_preview(conn, %{"id" => id, "ty" => ty}) do
  #   redirect(conn,
  #     external:
  #       Maps.view_preview_url(
  #         conn.assigns.current_user,
  #         String.to_integer(id),
  #         preview_ty_to_atom(ty)
  #       )
  #   )
  # end

  # defp preview_ty_to_atom(ty) do
  #   case ty do
  #     "icon" -> :icon
  #     "preview" -> :preview
  #   end
  # end
end
