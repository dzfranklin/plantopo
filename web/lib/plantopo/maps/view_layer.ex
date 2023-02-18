defmodule PlanTopo.Maps.ViewLayer do
  use Ecto.Schema
  import Ecto.Changeset
  alias PlanTopo.{JSONTerm, Maps.ViewLayerSource}

  embedded_schema do
    belongs_to :source, ViewLayerSource

    field :opacity, :float, default: 1.0

    embeds_many :prop_overrides, Prop, on_replace: :delete do
      field :comment, :string

      field :layer_id, :string
      field :layer_type, :string

      field :property_category, :string
      field :property_name, :string
      field :value, JSONTerm
    end
  end

  def changeset(layer \\ %__MODULE__{}, attrs) do
    layer
    |> cast(attrs, [:source_id, :id, :opacity])
    |> cast_embed(:prop_overrides, with: &prop_override_changeset/2)
  end

  def prop_override_changeset(prop_override, attrs) do
    prop_override
    |> cast(attrs, [
      :id,
      :comment,
      :layer_id,
      :layer_type,
      :property_category,
      :property_name,
      :value
    ])
    |> validate_required([:property_name, :value])
    |> validate_selector()
  end

  defp validate_selector(change) do
    if is_nil(get_field(change, :layer_id)) || is_nil(get_field(change, :layer_type)) do
      change
    else
      add_error(change, :layer_type, "if layer_id is specified layer_type must not be specified")
    end
  end
end
