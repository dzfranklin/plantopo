defmodule PlanTopo.MapFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `PlanTopo.Maps.Views` context.
  """
  alias PlanTopo.Maps

  def valid_view_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      name: "View #{System.unique_integer()}",
      layers: [
        %{
          source_id: view_source_fixture().id,
          prop_overrides: [
            %{
              layer_id: "bg",
              property_name: "visibility",
              value_json: ~S["hidden"]
            }
          ]
        }
      ]
    })
  end

  def view_fixture(user, attrs \\ %{}) do
    attrs = valid_view_attributes(attrs)
    {:ok, view} = Maps.create_view(user, attrs)
    view
  end

  def default_view_fixture(attrs \\ %{}) do
    {:ok, view} = attrs |> valid_view_attributes() |> Maps.create_default_view()
    view
  end

  def valid_view_source_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      name: "View Source #{System.unique_integer()}",
      data_id: source_data_fixture().id,
      layers_spec_json: "[]"
    })
  end

  def view_source_fixture(attrs \\ %{}) do
    {:ok, source} = attrs |> valid_view_source_attributes() |> Maps.create_view_source()
    source
  end

  def valid_source_data_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      id: "source-data-#{System.unique_integer()}",
      spec_json: "{}"
    })
  end

  def source_data_fixture(attrs \\ %{}) do
    {:ok, data} = attrs |> valid_source_data_attributes() |> Maps.create_source_data()
    data
  end
end
