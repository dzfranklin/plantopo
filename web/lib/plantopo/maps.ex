defmodule PlanTopo.Maps do
  @moduledoc """
  The Maps context.
  """

  import Ecto.Query, warn: false
  alias Ecto.Changeset
  alias PlanTopo.AuthError, warn: false
  alias PlanTopo.{Repo, Accounts.User}
  alias __MODULE__.{ViewAt, Meta, AutoSave, HistorySave, LayerData, LayerSource, Role}
  require Logger

  @hx_interval_secs 60 * 60

  def create!(%User{id: user_id}, attrs) do
    Repo.transaction!(fn ->
      map =
        Meta.changeset(attrs)
        |> Repo.insert!()

      %{user_id: user_id, map_id: map.id, value: :owner}
      |> Role.changeset()
      |> Repo.insert!()

      map
    end)
  end

  def update_meta!(%User{} = user, %Meta{} = meta, attrs) do
    if role(user, meta.id) not in [:editor, :owner], do: raise(AuthError)

    Meta.changeset(meta, attrs)
    |> Repo.update!()
  end

  def delete!(%User{} = user, %Meta{} = meta) do
    if role(user, meta.id) != :owner, do: raise(AuthError)
    Repo.delete!(meta)
  end

  def list_owned_by(%User{id: user_id}) do
    where(Role, user_id: ^user_id)
    |> where([p], p.value == :owner)
    |> join(:inner, [p], m in assoc(p, :map))
    |> order_by(desc: :updated_at)
    |> select([p, m], m)
    |> Repo.all()
  end

  def list_shared_with(%User{id: user_id}) do
    where(Role, user_id: ^user_id)
    |> where([p], p.value != :owner)
    |> join(:inner, [p], m in assoc(p, :map))
    |> order_by(desc: :updated_at)
    |> select([p, m], {m, p})
    |> Repo.all()
  end

  def role(nil, map_id) do
    where(Role, map_id: ^map_id)
    |> where([p], is_nil(p.user_id))
    |> Repo.one()
    |> role_to_value()
  end

  def role(%User{id: user_id}, map_id) when not is_nil(user_id) do
    where(Role, user_id: ^user_id, map_id: ^map_id)
    |> Repo.one()
    |> role_to_value()
  end

  defp role_to_value(perm) do
    case perm do
      nil -> :none
      %Role{value: value} -> value
    end
  end

  def set_role(%User{id: user_id}, map_id, value) when not is_nil(user_id) do
    %{user_id: user_id, map_id: map_id, value: value}
    |> Role.changeset()
    |> Repo.insert()
  end

  def set_role(nil, map_id, value) do
    if value in [:viewer, :editor] do
      %{map_id: map_id, value: value}
      |> Role.changeset()
      |> Repo.insert()
    else
      raise "Cannot give everyone owner role"
    end
  end

  def get_autosave_snapshot(map_id) do
    AutoSave
    |> select([s], s.snapshot)
    |> where(map_id: ^map_id)
    |> Repo.one()
  end

  def get_autosave_as_update(map_id) do
    AutoSave
    |> select([s], s.as_update)
    |> where(map_id: ^map_id)
    |> Repo.one()
  end

  def autosave(attrs) do
    value = AutoSave.changeset(attrs)
    map_id = Changeset.get_field(value, :map_id)

    Repo.transaction(fn ->
      prev_auto = Repo.get(AutoSave, map_id)

      prev_hx_at =
        HistorySave
        |> where(map_id: ^map_id)
        |> order_by(desc: :saved_at)
        |> select([s], s.saved_at)
        |> limit(1)
        |> Repo.one()

      if not is_nil(prev_auto) do
        if is_nil(prev_hx_at) or DateTime.diff(prev_auto.saved_at, prev_hx_at) > @hx_interval_secs do
          prev_auto
          |> Map.from_struct()
          |> HistorySave.changeset()
          |> Repo.insert!()
        end
      end

      Repo.insert!(value, conflict_target: :map_id, on_conflict: :replace_all)
    end)
  end

  def list_all_history_saves(map_id) do
    HistorySave
    |> where(map_id: ^map_id)
    |> Repo.all()
  end

  def get_view_at(user_id, map_id) do
    ViewAt
    |> where(user_id: ^user_id, map_id: ^map_id)
    |> Repo.one()
  end

  def update_view_at(user_id, map_id, attrs) do
    ViewAt.meta_changeset(%{user_id: user_id, map_id: map_id})
    |> ViewAt.value_changeset(attrs)
    |> Repo.insert(conflict_target: [:user_id, :map_id], on_conflict: :replace_all)
  end

  def make_fallback_view_at(user_id, map_id, center) do
    {lng, lat} = center

    %ViewAt{
      user_id: user_id,
      map_id: map_id,
      bearing: 0,
      pitch: 0,
      zoom: 8,
      center_lng: lng,
      center_lat: lat
    }
  end

  # London
  @default_fallback_center {-0.0955, 51.5095}

  def lookup_fallback_center(ip) do
    with {:ok, %{"location" => location}} <- :locus.lookup(:city, ip) do
      {location["longitude"], location["latitude"]}
    else
      :not_found ->
        Logger.info("geoip data not found for: #{inspect(ip)}")
        @default_fallback_center

      {:error, error} ->
        Logger.info("Error performing geoip lookup on #{inspect(ip)}: #{inspect(error)}")
        @default_fallback_center
    end
  end

  def list_layer_sources(user, except \\ [])

  def list_layer_sources(%User{}, except) do
    # TODO: Restrict based on user
    list_layer_sources(nil, except)
  end

  def list_layer_sources(nil, except) do
    LayerSource
    |> where([s], s.id not in ^except)
    |> preload(:dependencies)
    |> Repo.all()
  end

  def list_layer_datas(user, except \\ [])

  def list_layer_datas(%User{}, except) do
    # TODO: Restrict based on user
    list_layer_datas(nil, except)
  end

  def list_layer_datas(nil, except) do
    LayerData
    |> where([s], s.id not in ^except)
    |> Repo.all()
  end

  def import_mapbox_style(source_id, sty, fallbacks \\ %{}, transform_dep \\ & &1) do
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

    {
      LayerSource.changeset(%{
        id: source_id,
        name: name,
        layer_specs: layers,
        glyphs: glyphs,
        sprite: sprite
      }),
      Enum.map(transformed_deps, &LayerData.changeset/1)
    }
  end
end
