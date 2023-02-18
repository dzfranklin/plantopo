defmodule PlanTopo.Accounts.UserSettings do
  use Ecto.Schema
  import Ecto.Changeset

  schema "user_settings" do
    has_one :user, PlanTopo.Accounts.User, foreign_key: :settings_id
    field :disable_animation, :boolean, default: false
    field :advanced, :boolean, default: false

    timestamps()
  end

  def changeset(user_settings \\ %__MODULE__{}, attrs) do
    user_settings
    |> cast(attrs, [:disable_animation])
    |> validate_required([:disable_animation])
  end
end
