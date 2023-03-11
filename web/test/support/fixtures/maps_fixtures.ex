defmodule PlanTopo.MapsFixtures do
  alias PlanTopo.Maps
  def unique_map_name, do: "Map #{System.unique_integer([:positive])}"

  def map_fixture(user, attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        name: unique_map_name()
      })

    Maps.create!(user, attrs)
  end

  def valid_autosave_attributes(map, attrs \\ %{}) do
    Enum.into(attrs, %{
      snapshot: <<0>>,
      as_update: <<0>>,
      data: %{},
      saved_at: DateTime.from_unix!(0)
    })
    |> Map.put(:map_id, map.id)
  end
end
