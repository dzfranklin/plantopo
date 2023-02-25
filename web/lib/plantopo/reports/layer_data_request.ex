defmodule PlanTopo.Reports.LayerDataRequest do
  use PlanTopo.Schema

  @primary_key {:id, :id, autogenerate: true}
  schema "reported_layer_data_requests" do
    field :alleged_user_id, Ecto.UUID
    field :at, :utc_datetime
    field :url, :string
    field :host, :string
    field :path, :string
    field :path_seg_1, :string
    field :path_seg_2, :string
  end

  def changeset(req \\ %__MODULE__{}, attrs) do
    req
    |> cast(attrs, [:alleged_user_id, :at, :url, :host, :path, :path_seg_1, :path_seg_2])
    |> validate_required([:alleged_user_id, :at, :url, :host, :path])
  end
end
