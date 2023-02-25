defmodule PlanTopo.Maps.Snapshot do
  use PlanTopo.Schema
  alias PlanTopo.Maps

  schema "map_snapshots" do
    belongs_to :map, Maps.Meta
    field :state, :binary
    field :data, :string
    field :snapshot_at, :utc_datetime
    field :after_error, :string
  end

  def changeset(snapshot \\ %__MODULE__{}, attrs) do
    snapshot
    |> cast(attrs, [:map_id, :state, :data, :snapshot_at, :after_error])
    |> validate_required([:map_id, :state, :data, :snapshot_at])
  end
end
