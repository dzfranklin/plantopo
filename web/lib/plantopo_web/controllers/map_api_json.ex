defmodule PlanTopoWeb.MapApiJSON do
  alias PlanTopo.Maps
  alias Maps.{ViewAt, ViewDataSource, ViewLayerSource, ViewLayer, View}

  def list_view_sources(%{layer_sources: layer_sources, data_sources: data_sources}) do
    layer_sources =
      Enum.map(layer_sources, &{&1.id, view_layer_source(&1)})
      |> Enum.into(%{})

    data_sources = Enum.map(data_sources, &{&1.id, view_data_source(&1)}) |> Enum.into(%{})

    %{data: %{layerSources: layer_sources, dataSources: data_sources}}
  end

  def show_view(%{view: view}) do
    %{data: view(view)}
  end

  def view(view) do
    %{
      id: view.id,
      name: view.name,
      layers: Enum.map(view.layers, &view_layer/1)
    }
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
      glyphs: v.glyphs,
      sprite: v.sprite,
      layerSpecs: v.layer_specs
    }
  end

  def view_data_source(%ViewDataSource{} = v) do
    %{
      id: v.id,
      creditOS: v.credit_os,
      spec: v.spec
    }
  end

  def view_layer(%ViewLayer{} = v) do
    %{
      id: v.id,
      opacity: v.opacity,
      sourceId: v.source_id,
      propOverrides: Enum.map(v.prop_overrides, &prop_override/1)
    }
  end

  def prop_override(%ViewLayer.Prop{layer_id: layer_id, layer_type: nil} = p)
      when not is_nil(layer_id) do
    Map.put(prop_override_common(p), :layerId, layer_id)
  end

  def prop_override(%ViewLayer.Prop{layer_id: nil, layer_type: layer_type} = p)
      when not is_nil(layer_type) do
    Map.put(prop_override_common(p), :layerType, layer_type)
  end

  defp prop_override_common(p) do
    %{
      id: p.id,
      comment: p.comment,
      propertyCategory: p.property_category,
      propertyName: p.property_name,
      value: p.value
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

  # alias PlanTopo.Maps.{SourceData, Views, Views.View}
  # import PlanTopoWeb.PaginatedJSON

  # def view_index(%{page: page, next: next}) do
  #   paginated(page, next: next, each: &data/1)
  # end

  # def source_index(%{view_source: view_source, source_data: source_data}) do
  #   %{
  #     data: %{
  #       view_source: Enum.map(view_source, &data/1),
  #       source_data: Enum.map(source_data, &data/1)
  #     }
  #   }
  # end

  # def show(%{item: item}), do: %{data: data(item)}

  # defp data(%View{} = view) do
  #   %{
  #     id: view.id,
  #     owner_id: view.owner_id,
  #     name: view.name,
  #     layers: Enum.map(view.layers, &data/1),
  #     updated_at: view.updated_at
  #   }
  # end

  # defp data(%Views.Layer{} = layer) do
  #   %{
  #     id: layer.id,
  #     source_id: layer.source_id,
  #     prop_overrides: Enum.map(layer.prop_overrides, &data/1)
  #   }
  # end

  # defp data(%Views.Layer.Prop{} = prop) do
  #   %{
  #     id: prop.id,
  #     layer_id: prop.layer_id,
  #     property_name: prop.property_name,
  #     value: Jason.decode!(prop.value_json)
  #   }
  # end

  # defp data(%Views.Source{} = source) do
  #   %{
  #     id: source.id,
  #     name: source.name,
  #     data_id: source.data_id,
  #     layers_spec: Jason.decode!(source.layers_spec_json),
  #     updated_at: source.updated_at
  #   }
  # end

  # defp data(%SourceData{} = data) do
  #   %{
  #     id: data.id,
  #     spec: Jason.decode!(data.spec_json)
  #   }
  # end
end
