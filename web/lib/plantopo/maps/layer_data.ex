defmodule PlanTopo.Maps.LayerData do
  use PlanTopo.Schema

  @primary_key {:id, :string, autogenerate: false}
  schema "map_layer_datas" do
    field :spec, :map
    field :attribution, :string

    timestamps()
  end

  def changeset(source_data \\ %__MODULE__{}, attrs) do
    source_data
    |> cast(attrs, [:id, :spec, :attribution])
    |> validate_required([:id, :spec])
  end
end
