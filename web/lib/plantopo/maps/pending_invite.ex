defmodule PlanTopo.Maps.PendingInvite do
  use PlanTopo.Schema

  @type t :: %__MODULE__{}

  schema "pending_map_invites" do
    belongs_to(:map, PlanTopo.Maps.Meta)
    field(:email, :string)
    field(:role, Ecto.Enum, values: [:viewer, :editor])
    field(:notify, :boolean)
    field(:notify_message, :string)
  end

  def changeset(invite, attrs) do
    invite
    |> cast(attrs, [:map_id, :email, :role, :notify, :notify_message])
    |> validate_required([:map_id, :email, :role])
  end
end
