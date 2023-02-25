defmodule PlanTopoWeb.MapJSON do
  alias PlanTopo.Maps
  alias Maps.{ViewAt, LayerData, LayerSource}

  def view_at(%ViewAt{} = v) do
    %{
      center: v.center,
      zoom: v.zoom,
      pitch: v.pitch,
      bearing: v.bearing
    }
  end

  def layer_sources(list) do
    list
    |> Enum.map(&{&1.id, layer_source(&1)})
    |> Enum.into(%{})
  end

  def layer_datas(list) do
    list
    |> Enum.map(&{&1.id, layer_data(&1)})
    |> Enum.into(%{})
  end

  def tokens do
    tokens = Application.fetch_env!(:plantopo, :frontend_tokens)

    %{
      mapbox: Keyword.fetch!(tokens, :mapbox),
      os: Keyword.fetch!(tokens, :os)
    }
  end

  defp layer_source(%LayerSource{} = v) do
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

  defp layer_data(%LayerData{} = v) do
    %{
      id: v.id,
      attribution: v.attribution,
      spec: v.spec
    }
  end
end
