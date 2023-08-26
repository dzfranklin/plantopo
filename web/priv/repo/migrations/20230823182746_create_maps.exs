defmodule PlanTopo.Repo.Migrations.CreateMaps do
  use Ecto.Migration

  def change do
    execute(
      "CREATE TYPE map_general_access AS ENUM ('public', 'restricted')",
      "DROP TYPE map_general_access"
    )

    execute(
      "CREATE TYPE map_role AS ENUM ('owner', 'editor', 'viewer')",
      "DROP TYPE map_role"
    )

    create table(:map_meta) do
      add(:is_deleted, :boolean, default: false)
      add(:owner_id, references(:users))
      add(:general_access_level, :map_general_access, default: "restricted")
      add(:general_access_role, :map_role, default: "viewer")
      add(:name, :string)
      timestamps()
    end

    create table(:map_snapshots) do
      add(:map_id, references(:map_meta))
      add(:value, :jsonb)
      timestamps()
    end

    create table(:map_access, primary_key: false) do
      add(:map_id, references(:map_meta), primary_key: true)
      add(:user_id, references(:users), primary_key: true)
      add(:role, :map_role)
      timestamps()
    end

    create table(:pending_map_invites) do
      add(:map_id, references(:map_meta))
      add(:email, :citext)
      add(:role, :map_role)
      add(:notify, :boolean)
      add(:notify_message, :string)
    end
  end
end
