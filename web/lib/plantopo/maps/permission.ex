defmodule PlanTopo.Maps.Role do
  use PlanTopo.Schema
  alias PlanTopo.{Accounts.User, Maps}

  @primary_key false
  schema "map_roles" do
    belongs_to :user, User, primary_key: true
    belongs_to :map, Maps.Meta, primary_key: true
    field :value, Ecto.Enum, values: [:viewer, :editor, :owner]
    timestamps()
  end

  def changeset(role \\ %__MODULE__{}, attrs) do
    role
    |> cast(attrs, [:user_id, :map_id, :value])
    |> validate_required([:user_id, :map_id, :value])
  end
end
