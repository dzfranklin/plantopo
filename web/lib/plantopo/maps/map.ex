defmodule PlanTopo.Maps.Map do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.{Accounts.User, Maps}
  alias Maps.{ViewAt, ViewLayer}

  schema "maps" do
    belongs_to :owner, User

    embeds_many :view_layers, ViewLayer

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
    |> cast_embed(:view_layers)
    |> validate_required([:view_id, :features, :view_layers])
  end
end
