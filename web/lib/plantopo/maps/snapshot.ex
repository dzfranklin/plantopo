defmodule PlanTopo.Maps.Snapshot do
  use PlanTopo.Schema
  alias PlanTopo.Maps

  @primary_key {:id, :id, autogenerate: true}
  schema "map_snapshots" do
    belongs_to :map, Maps.Meta
    field :snapshot, :binary
    field :as_update, :binary
    field :data, :map
    field :snapshot_at, :utc_datetime
  end

  def changeset(snapshot \\ %__MODULE__{}, attrs) do
    snapshot
    |> cast(attrs, [:map_id, :snapshot, :as_update, :data, :snapshot_at])
    |> validate_required([:map_id, :snapshot, :as_update, :data, :snapshot_at])
  end
end
