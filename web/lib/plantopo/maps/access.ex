defmodule PlanTopo.Maps.Access do
  use PlanTopo.Schema

  @type t :: %__MODULE__{}

  @primary_key false
  schema "map_access" do
    belongs_to(:map, PlanTopo.Maps.Meta, primary_key: true)
    belongs_to(:user, PlanTopo.Accounts.User, primary_key: true)
    field(:role, Ecto.Enum, values: [:viewer, :editor])

    timestamps()
  end

  @doc false
  def changeset(authorization, attrs) do
    authorization
    |> cast(attrs, [:map_id, :user_id, :role])
    |> validate_required([:map_id, :user_id, :role])
  end
end
