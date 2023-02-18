defmodule PlanTopo.Maps.ViewAt do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.{Accounts.User, Maps.Map}

  @primary_key false
  schema "map_view_at" do
    belongs_to :user, User, primary_key: true
    belongs_to :map, Map, primary_key: true

    field :center, {:array, :float}
    field :zoom, :float
    field :pitch, :float
    field :bearing, :float

    timestamps()
  end

  def changeset(data \\ %__MODULE__{}, attrs) do
    data
    |> cast(attrs, [:map_id, :center, :zoom, :pitch, :bearing])
    |> validate_required([:user_id, :map_id, :center, :zoom, :pitch, :bearing])
    |> validate_center()
  end

  defp validate_center(change) do
    center = get_field(change, :center)

    if length(center) != 2 do
      add_error(change, :center, "invalid form")
    else
      change
    end
  end
end
