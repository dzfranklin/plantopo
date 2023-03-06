defmodule PlanTopo.Reports.TileLoadReport do
  use PlanTopo.Schema

  @primary_key {:id, :id, autogenerate: true}
  schema "tile_load_reports" do
    field :alleged_user_id, Ecto.UUID
    field :at, :utc_datetime
    field :source, :string
    field :x, :integer
    field :y, :integer
    field :z, :integer
  end

  def changeset(req \\ %__MODULE__{}, attrs) do
    req
    |> cast(attrs, [:alleged_user_id, :at, :source, :x, :y, :z])
    |> validate_required([:alleged_user_id, :at, :source, :x, :y, :z])
  end
end
