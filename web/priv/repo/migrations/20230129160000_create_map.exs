defmodule PlanTopo.Repo.Migrations.CreateMapSourceData do
  use Ecto.Migration

  def up do
    create table(:map_view_data_sources, primary_key: false) do
      add :id, :string, primary_key: true
      add :spec, :map
      add :credit_os, :boolean

      timestamps()
    end

    create table(:map_view_layer_sources) do
      add :name, :string
      add :layer_specs, {:array, :map}
      add :glyphs, :string
      add :sprite, :string

      timestamps()
    end

    create table(:map_view_layer_source_dependencies, primary_key: false) do
      add :source_id, references(:map_view_layer_sources, on_delete: :delete_all),
        primary_key: true

      add :data_id, references(:map_view_data_sources, on_delete: :delete_all, type: :string),
        primary_key: true
    end

    create table(:map_views) do
      add :owner_id, references(:users, on_delete: :delete_all)
      add :name, :string
      add :layers, {:array, :map}
      timestamps()
    end

    create index(:map_views, [:owner_id])

    create table(:maps) do
      add :owner_id, references(:users, on_delete: :delete_all)
      add :view_id, references(:map_views, on_delete: :nothing)
      add :features, :map
      timestamps()
    end

    create index(:maps, [:owner_id])

    create table(:map_view_at, primary_key: false) do
      add :user_id, references(:users, on_delete: :delete_all), primary_key: true
      add :map_id, references(:maps, on_delete: :delete_all), primary_key: true

      add :center, {:array, :float}
      add :zoom, :float
      add :pitch, :float
      add :bearing, :float

      timestamps()
    end
  end
end
