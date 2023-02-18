defmodule PlanTopo.Repo.Migrations.CreateUserSettings do
  use Ecto.Migration

  def change do
    create table(:user_settings) do
      add :disable_animation, :boolean, null: false
      add :advanced, :boolean, null: false

      timestamps()
    end

    alter table(:users) do
      add :settings_id, references(:user_settings, on_delete: :nilify_all)
    end
  end
end
