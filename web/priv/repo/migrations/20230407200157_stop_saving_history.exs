defmodule PlanTopo.Repo.Migrations.StopSavingHistory do
  use Ecto.Migration

  def change do
    if direction() == :up do
      drop_if_exists table(:map_history_saves)
      drop_if_exists table(:map_auto_saves)
    end

    create table(:map_saves, primary_key: false) do
      add :map_id, :uuid, primary_key: true
      add :server_id, :integer, primary_key: true

      add :client, :binary, null: false
      add :saved_at, :utc_datetime, null: false
    end

    create table(:next_client_id, primary_key: false) do
      add :map_id, :uuid, primary_key: true
      add :server_id, :integer, primary_key: true

      add :next_suffix, :bigint, null: false
    end

    create unique_index(:next_client_id, [:map_id, :server_id])
  end
end
