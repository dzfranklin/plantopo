defmodule PlanTopo.Maps.Meta do
  use PlanTopo.Schema
  alias PlanTopo.Maps

  @derive Phoenix.Param

  schema "maps" do
    field :name, :string
    has_many :viewer_at, Maps.ViewAt, foreign_key: :map_id
    has_many :roles, Maps.Role, foreign_key: :map_id
    timestamps()
  end

  def changeset(meta \\ %__MODULE__{}, attrs) do
    meta
    |> cast(attrs, [:name])
  end
end
