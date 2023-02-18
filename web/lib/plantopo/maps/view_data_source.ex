defmodule PlanTopo.Maps.ViewDataSource do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "map_view_data_sources" do
    field :spec, :map
    field :credit_os, :boolean, default: false

    timestamps()
  end

  def changeset(source_data \\ %__MODULE__{}, attrs) do
    source_data
    |> cast(attrs, [:id, :spec, :credit_os])
    |> validate_required([:id, :spec, :credit_os])
  end
end
