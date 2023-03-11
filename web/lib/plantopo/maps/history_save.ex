defmodule PlanTopo.Maps.HistorySave do
  use PlanTopo.Schema
  alias PlanTopo.Maps

  @primary_key {:id, :id, autogenerate: true}
  schema "map_history_saves" do
    belongs_to :map, Maps.Meta
    field :snapshot, :binary
    field :as_update, :binary
    field :data, :map
    field :saved_at, :utc_datetime
  end

  def changeset(snapshot \\ %__MODULE__{}, attrs) do
    snapshot
    |> cast(attrs, [:map_id, :snapshot, :as_update, :data, :saved_at])
    |> validate_required([:map_id, :snapshot, :as_update, :data, :saved_at])
  end
end
