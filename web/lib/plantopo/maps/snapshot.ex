defmodule PlanTopo.Maps.Snapshot do
  use PlanTopo.Schema

  @type t :: %__MODULE__{}

  schema "map_snapshots" do
    belongs_to(:map, PlanTopo.Maps.Meta)
    field(:value, :map)

    timestamps()
  end

  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [:map_id, :value])
    |> validate_required([:map_id, :value])
  end
end
