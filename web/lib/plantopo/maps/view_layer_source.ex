defmodule PlanTopo.Maps.ViewLayerSource do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.Maps.ViewDataSource

  schema "map_view_layer_sources" do
    field :name, :string
    field :layer_specs, {:array, :map}
    field :glyphs, :string
    field :sprite, :string

    many_to_many :dependencies, ViewDataSource,
      join_through: "map_view_layer_source_dependencies",
      join_keys: [source_id: :id, data_id: :id]

    timestamps()
  end

  def changeset(source \\ %__MODULE__{}, attrs) do
    source
    |> cast(attrs, [:name, :layer_specs, :glyphs, :sprite])
    |> cast_assoc(:dependencies)
    |> validate_required([:name, :layer_specs])
  end
end
