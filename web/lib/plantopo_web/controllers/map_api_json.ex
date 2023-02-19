defmodule PlanTopoWeb.MapApiJSON do
  alias PlanTopo.Maps
  alias Maps.{ViewAt, ViewDataSource, ViewLayerSource, ViewLayer}

  def map(map) do
    %{
      id: map.id,
      viewLayers: Enum.map(map.view_layers, &view_layer/1),
      features: map.features
    }
  end

  def layer_sources(list) do
    list
    |> Enum.map(&{&1.id, view_layer_source(&1)})
    |> Enum.into(%{})
  end

  def data_sources(list) do
    list
    |> Enum.map(&{&1.id, view_data_source(&1)})
    |> Enum.into(%{})
  end

  def tokens do
    tokens = Application.fetch_env!(:plantopo, :frontend_tokens)

    %{
      mapbox: Keyword.fetch!(tokens, :mapbox),
      os: Keyword.fetch!(tokens, :os)
    }
  end

  def view_layer_source(%ViewLayerSource{} = v) do
    %{
      id: v.id,
      name: v.name,
      defaultOpacity: v.default_opacity,
      dependencies: Enum.map(v.dependencies, & &1.id),
      glyphs: v.glyphs,
      sprite: v.sprite,
      layerSpecs: v.layer_specs
    }
  end

  def view_data_source(%ViewDataSource{} = v) do
    %{
      id: v.id,
      attribution: v.attribution,
      spec: v.spec
    }
  end

  def view_layer(%ViewLayer{} = v) do
    %{
      id: v.id,
      sourceId: v.source_id,
      opacity: v.opacity
    }
  end

  def view_at(%ViewAt{} = v) do
    %{
      center: v.center,
      zoom: v.zoom,
      pitch: v.pitch,
      bearing: v.bearing
    }
  end
end
