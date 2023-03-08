defmodule PlanTopo.Maps.Snapshot do
  use PlanTopo.Schema
  alias PlanTopo.Maps

  schema "map_snapshots" do
    belongs_to :map, Maps.Meta
    field :data, :map
    field :snapshot_at, :utc_datetime
  end
end
