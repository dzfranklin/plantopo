defmodule PlanTopo.Maps.ViewDataSource do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "map_view_data_sources" do
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
