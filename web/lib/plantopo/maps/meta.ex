defmodule PlanTopo.Maps.Meta do
  use PlanTopo.Schema

  @type t :: %__MODULE__{}

  schema "map_meta" do
    field(:is_deleted, :boolean, default: false)
    belongs_to(:owner, PlanTopo.Accounts.User)
    field(:general_access_level, Ecto.Enum, values: [:public, :restricted], default: :restricted)
    field(:general_access_role, Ecto.Enum, values: [:viewer, :editor], default: :viewer)
    field(:name, :string)

    timestamps()
  end

  def changeset(meta, attrs) do
    meta
    |> cast(attrs, [:name, :general_access_level, :general_access_role, :owner_id, :is_deleted])
    |> validate_required([:owner_id])
  end
end
