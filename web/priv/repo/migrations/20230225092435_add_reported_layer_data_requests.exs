defmodule PlanTopo.Repo.Migrations.AddReportedLayerDataRequests do
  use Ecto.Migration

  def change do
    create table(:reported_layer_data_requests, primary_key: [type: :bigserial]) do
      add :alleged_user_id, :binary
      add :at, :utc_datetime
      add :source, :string
      add :x, :integer
      add :y, :integer
      add :z, :integer
    end
  end
end
