defmodule PlanTopo.Maps do
  @moduledoc """
  The Maps.Maps context.
  """

  import Ecto.Query, warn: false
  alias PlanTopo.AuthError, warn: false
  alias PlanTopo.{Maps, Repo, Accounts.User}
  alias __MODULE__.{ViewAt, ViewDataSource, ViewLayerSource}
  require Logger

  def get_map!(%User{id: user_id}, id) do
    Maps.Map
    |> where([m], m.owner_id == ^user_id and m.id == ^id)
    |> Repo.one!()
  end

  def list_view_layer_sources(%User{}, except \\ []) do
    # TODO: Restrict based on user
    ViewLayerSource
    |> where([s], s.id not in ^except)
    |> preload(:dependencies)
    |> Repo.all()
  end

  def list_view_data_sources(%User{}, except \\ []) do
    # TODO: Restrict based on user
    ViewDataSource
    |> where([s], s.id not in ^except)
    |> Repo.all()
  end

  def get_view_at(%User{id: user_id} = user, map_id, ip) do
    record =
      ViewAt
      |> where(user_id: ^user_id, map_id: ^map_id)
      |> Repo.one()

    if is_nil(record) do
      get_fallback_view_at(user, map_id, ip)
    else
      record
    end
  end

  def get_fallback_view_at(%User{id: user_id}, map_id, ip) do
    %ViewAt{
      user_id: user_id,
      map_id: map_id,
      bearing: 0,
      pitch: 0,
      zoom: 8,
      center: get_fallback_center(ip)
    }
  end

  # London
  @default_fallback_center [-0.0955, 51.5095]

  defp get_fallback_center(ip) do
    with {:ok, %{"location" => location}} <- :locus.lookup(:city, ip) do
      [location["longitude"], location["latitude"]]
    else
      :not_found ->
        Logger.info("geoip data not found for: #{inspect(ip)}")
        @default_fallback_center

      {:error, error} ->
        Logger.info("Error performing geoip lookup on #{inspect(ip)}: #{inspect(error)}")
        @default_fallback_center
    end
  end

  def set_view_at!(%User{id: user_id}, map_id, attrs) do
    %ViewAt{user_id: user_id, map_id: map_id}
    |> ViewAt.changeset(attrs)
    |> Repo.insert!(
      on_conflict: :replace_all,
      conflict_target: [:user_id, :map_id]
    )
  end

  def import_mapbox_style!(sty, fallbacks \\ %{}, transform_dep \\ & &1) do
    sty = Jason.decode!(sty)

    %{
      "version" => 8,
      "sources" => sources,
      "layers" => layers,
      "glyphs" => glyphs,
      "sprite" => sprite
    } = sty

    name = Map.get_lazy(sty, "name", fn -> Map.fetch!(fallbacks, "name") end)

    source_deps = Enum.to_list(sources)

    transformed_deps =
      Enum.map(source_deps, fn {id, spec} ->
        transform_dep.(%{"id" => id, "spec" => spec})
      end)

    dep_trans_mapping =
      Enum.zip_with(source_deps, transformed_deps, fn
        {source_id, _}, %{"id" => trans_id} -> {source_id, trans_id}
      end)
      |> Enum.into(%{})

    layers =
      Enum.map(layers, fn l ->
        if Map.has_key?(l, "source") do
          val = Map.get(l, "source")
          Map.put(l, "source", Map.get(dep_trans_mapping, val, val))
        else
          l
        end
      end)

    ViewLayerSource.changeset(%{
      name: name,
      layer_specs: layers,
      glyphs: glyphs,
      sprite: sprite,
      dependencies: transformed_deps
    })
    |> Repo.insert!()
  end

  # @doc """
  # Returns the tuple `{view_sources, source_datas}`.
  # """
  # def list_sources do
  #   sources =
  #     Views.Source
  #     |> order_by([:name, :id])
  #     |> Repo.all()

  #   datas =
  #     SourceData
  #     |> order_by([:id])
  #     |> Repo.all()

  #   {sources, datas}
  # end

  # @doc """
  # Returns the list of views a user can use.
  # """
  # def list_views(user, cursor \\ nil) do
  #   View
  #   |> where([v], is_nil(v.owner_id) or v.owner_id == ^user.id)
  #   |> order_by(desc: :updated_at, asc: :id)
  #   |> Repo.paginate(after: cursor, cursor_fields: [{:updated_at, :desc}, :id])
  # end

  # @doc """
  # Gets a single views.

  # Raises `Ecto.NoResultsError` if the View does not exist.
  # """
  # def get_view!(user, id) do
  #   View
  #   |> where(owner_id: ^user.id, id: ^id)
  #   |> Repo.one!()
  # end

  # @doc """
  # Returns a presigned URL for viewing the preview image. Expires in a week.

  # - user: the user, or nil for default
  # - ty: Either `:preview` or `:icon`
  # """
  # def view_preview_url(user, view_id, ty) do
  #   {:ok, url} =
  #     ExAws.Config.new(:s3)
  #     |> S3.presigned_url(:get, "map-view-icon", view_preview_object(user, view_id, ty),
  #       expires_in: 60 * 60 * 24 * 7
  #     )

  #   url
  # end

  # @doc """
  # Generate presigned URLs for POSTing new preview images. Content-Type must be
  # `"image/png"`. Expires in 2 hours.

  # - user: the user, or nil for default

  # Returns the tuple `{preview_upload_url, icon_upload_url}`
  # """
  # def view_preview_upload(user, view_id) do
  #   for ty <- [:preview, :icon] do
  #     {:ok, url} =
  #       ExAws.Config.new(:s3)
  #       |> S3.presigned_url(:put, "map-view-icon", view_preview_object(user, view_id, ty),
  #         headers: [{"Content-Type", "image/png"}],
  #         expires_in: 60 * 60 * 2
  #       )

  #     url
  #   end
  #   |> List.to_tuple()
  # end

  # defp view_preview_object(user, view_id, ty) when is_integer(view_id) do
  #   ty =
  #     case ty do
  #       :preview -> "preview"
  #       :icon -> "icon"
  #     end

  #   user =
  #     case user do
  #       nil -> "default"
  #       %User{id: user_id} when is_integer(user_id) -> "user-#{user_id}"
  #     end

  #   "#{user}/#{view_id}/#{ty}.png"
  # end

  # @doc """
  # Creates a view.
  # """
  # def create_view(%User{} = user, attrs) do
  #   View.changeset(attrs)
  #   |> View.change_owner(user)
  #   |> Repo.insert()
  # end

  # @doc """
  # Creates a default view.
  # """
  # def create_default_view(attrs) do
  #   View.changeset(attrs)
  #   |> Repo.insert()
  # end

  # @doc """
  # Updates a view.
  # """
  # def update_view(%User{} = user, %View{} = view, attrs) do
  #   if user.id != view.owner_id, do: raise(AuthError)

  #   view
  #   |> View.changeset(attrs)
  #   |> Repo.update()
  # end

  # @doc """
  # Deletes a view.
  # """
  # def delete_view(%User{} = user, %View{} = view) do
  #   if user.id != view.owner_id, do: raise(AuthError)

  #   Repo.delete(view)
  # end

  # @doc """
  # Creates a view source.
  # """
  # def create_view_source(attrs) do
  #   Views.Source.changeset(attrs)
  #   |> Repo.insert()
  # end

  # @doc """
  # Creates a source data.
  # """
  # def create_source_data(attrs) do
  #   SourceData.changeset(attrs)
  #   |> Repo.insert()
  # end
end
