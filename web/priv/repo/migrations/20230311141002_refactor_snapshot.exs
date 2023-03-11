defmodule PlanTopo.Repo.Migrations.PruneSnapshot do
  use Ecto.Migration

  def change do
    drop table(:map_snapshots)

    create table(:map_auto_saves, primary_key: false) do
      add :map_id, references(:maps, on_delete: :delete_all), primary_key: true
      add :snapshot, :binary, null: false
      add :as_update, :binary, null: false
      add :data, :jsonb
      add :saved_at, :naive_datetime, null: false
    end

    create table(:map_history_saves, primary_key: false) do
      add :id, :bigserial, primary_key: true
      add :map_id, references(:maps, on_delete: :delete_all), null: false
      add :snapshot, :binary
      add :as_update, :binary
      add :data, :jsonb
      add :saved_at, :naive_datetime
    end
  end
end
