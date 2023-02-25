defmodule PlanTopo.Maps.LayerSource do
  use PlanTopo.Schema
  alias PlanTopo.Maps.LayerData

  schema "map_layer_sources" do
    field :name, :string
    field :default_opacity, :float
    field :layer_specs, {:array, :map}
    field :glyphs, :string
    field :sprite, :string

    many_to_many :dependencies, LayerData,
      join_through: "map_layer_source_dependencies",
      join_keys: [source_id: :id, data_id: :id]

    timestamps()
  end

  def changeset(source \\ %__MODULE__{}, attrs) do
    source
    |> cast(attrs, [:name, :default_opacity, :layer_specs, :glyphs, :sprite])
    |> cast_assoc(:dependencies)
    |> validate_required([:name, :layer_specs])
  end
end
