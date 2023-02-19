defmodule PlanTopo.Maps.ViewLayer do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.Maps.ViewLayerSource

  embedded_schema do
    belongs_to :source, ViewLayerSource

    field :opacity, :float, default: 1.0
  end

  def changeset(layer \\ %__MODULE__{}, attrs) do
    layer
    |> cast(attrs, [:id, :source_id, :opacity])
  end
end
