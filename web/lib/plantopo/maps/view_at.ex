defmodule PlanTopo.Maps.ViewAt do
  use PlanTopo.Schema
  alias PlanTopo.{Accounts.User, Maps}

  @primary_key false
  schema "map_view_ats" do
    belongs_to :user, User, primary_key: true
    belongs_to :map, Maps.Meta, primary_key: true

    field :center_lng, :float
    field :center_lat, :float
    field :zoom, :float
    field :pitch, :float
    field :bearing, :float

    timestamps()
  end

  def changeset(at \\ %__MODULE__{}, attrs) do
    at
    |> cast(attrs, [:user_id, :map_id, :center, :zoom, :pitch, :bearing])
    |> validate_required([:user_id, :map_id, :center, :zoom, :pitch, :bearing])
  end
end
