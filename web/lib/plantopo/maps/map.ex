defmodule PlanTopo.Maps.Map do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.{Accounts.User, Maps}
  alias Maps.{View, ViewAt}

  schema "maps" do
    belongs_to :owner, User
    belongs_to :view, View

    # GeoJSON
    field :features, :map

    has_many :view_at, ViewAt

    timestamps()
  end

  def change_owner(map \\ %__MODULE__{}, attrs) do
    map
    |> cast(attrs, [:owner_id])
    |> validate_required([:owner_id])
  end

  def changeset(map \\ %__MODULE__{}, attrs) do
    map
    |> cast(attrs, [:view_id, :features])
    |> validate_required([:view_id, :features])
  end
end
