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

  @type token :: %{token: String.t(), clientId: number(), exp: String.t(), write: boolean()}

  @spec mint_sync_token!(String.t(), %User{} | nil) :: {:allow, token()} | :deny
  def mint_sync_token!(map_id, maybe_user) do
    case role(maybe_user, map_id) do
      nil ->
        :deny

      :viewer ->
        {:allow, authorize_sync_token!(map_id, maybe_user, false)}

      role when role in [:editor, :owner] ->
        {:allow, authorize_sync_token!(map_id, maybe_user, true)}

      _ ->
        :deny
    end
  end

  defp authorize_sync_token!(map_id, maybe_user, permit_write) do
    secret = Application.fetch_env!(:plantopo, __MODULE__) |> Keyword.fetch!(:sync_server_secret)

    %Finch.Response{status: 200, body: resp} =
      Finch.build(
        :post,
        # TODO: Discover server somehow
        "http://localhost:4004/authorize",
        [
          {"Content-Type", "application/json"},
          {"Authorization", "Bearer " <> secret}
        ],
        Jason.encode!(%{
          user_id: if(!is_nil(maybe_user), do: maybe_user.id),
          map_id: map_id,
          write: permit_write
        })
      )
      |> Finch.request!(PlanTopo.Finch)

    Jason.decode!(resp) |> IO.inspect()
  end

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

  @spec role(%User{} | nil, String.t()) :: Role.value() | nil

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

  @spec role_to_value(%Role{} | nil) :: Role.value() | nil
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
