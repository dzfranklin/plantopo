defmodule PlanTopo.Repo.Migrations.AddTileLoadReports do
  use Ecto.Migration

  def change do
    create table(:tile_load_reports, primary_key: [type: :bigserial]) do
      add :alleged_user_id, :binary
      add :at, :utc_datetime
      add :source, :string
      add :x, :integer
      add :y, :integer
      add :z, :integer
    end
  end
end
