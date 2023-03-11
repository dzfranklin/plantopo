defmodule PlanTopo.Maps.AutoSave do
  use PlanTopo.Schema
  alias PlanTopo.Maps

  @primary_key false
  schema "map_auto_saves" do
    belongs_to :map, Maps.Meta, primary_key: true
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
