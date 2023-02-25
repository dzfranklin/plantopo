defmodule PlanTopo.Repo.Migrations.AddReportedLayerDataRequests do
  use Ecto.Migration

  def change do
    create table(:reported_layer_data_requests, primary_key: [type: :bigserial]) do
      add :alleged_user_id, :binary
      add :at, :utc_datetime
      add :url, :string
      add :host, :string
      add :path, :string
      add :path_seg_1, :string
      add :path_seg_2, :string
    end
  end
end
