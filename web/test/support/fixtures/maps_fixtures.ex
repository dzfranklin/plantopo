defmodule PlanTopo.MapsFixtures do
  def valid_map_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      name: "Map #{System.unique_integer([:positive])}",
      owner_id: PlanTopo.AccountsFixtures.user_fixture().id
    })
  end

  def map_fixture(attrs \\ %{}) do
    {:ok, meta} = PlanTopo.Maps.create(valid_map_attributes(attrs))
    meta
  end
end
