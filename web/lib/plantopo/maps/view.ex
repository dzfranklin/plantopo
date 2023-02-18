defmodule PlanTopo.Maps.View do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.Accounts.User
  alias PlanTopo.Maps.ViewLayer

  schema "map_views" do
    belongs_to :owner, User
    field :name, :string
    embeds_many :layers, ViewLayer, on_replace: :delete

    timestamps()
  end

  def changeset(view \\ %__MODULE__{}, attrs) do
    view
    |> cast(attrs, [:name])
    |> cast_embed(:layers, required: false)
  end

  def change_owner(view, %User{id: id}) do
    if is_nil(id), do: raise(ArgumentError, "change_owner: nil not allowed")
    put_change(view, :owner_id, id)
  end
end
