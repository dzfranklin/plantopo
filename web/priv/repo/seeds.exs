# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     PlanTopo.Repo.insert!(%PlanTopo.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.
alias PlanTopo.{Repo, Accounts, Maps}
alias Maps.{ViewDataSource, ViewLayerSource}

{:ok, user} =
  Accounts.register_user(%{
    email: "test@example.com",
    password: "testpassword"
  })

satellite_data =
  Repo.insert!(%ViewDataSource{
    id: "mapbox.satellite",
    attribution: "mapbox",
    spec: %{
      type: "raster",
      tiles: [
        "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90"
      ],
      maxzoom: 21
    }
  })

satellite_layer_source =
  Repo.insert!(%ViewLayerSource{
    name: "Satellite",
    dependencies: [satellite_data],
    layer_specs: [
      %{
        id: "layer",
        source: satellite_data.id,
        type: "raster"
      }
    ]
  })

mapbox_dem_data =
  Repo.insert!(%ViewDataSource{
    id: "mapbox.dem",
    attribution: "mapbox",
    spec: File.read!("priv/mapbox_dem_source.json") |> Jason.decode!()
  })

hillshade_layer_source =
  Repo.insert(%ViewLayerSource{
    name: "Hillshading",
    default_opacity: 0.25,
    dependencies: [mapbox_dem_data],
    layer_specs: [
      %{
        id: "layer",
        source: mapbox_dem_data.id,
        type: "hillshade",
        paint: %{
          "hillshade-shadow-color": "rgba(0, 0, 0, 0.2)",
          "hillshade-accent-color": "rgba(0, 0, 0, 0)",
          "hillshade-highlight-color": "rgba(0, 0, 0, 0)"
        }
      }
    ]
  })

# TODO: Layer sources should have fine-grained clip paths so that we can clip around the uk.
# Or at least bboxes

os_vector_layer_source =
  Maps.import_mapbox_style!(
    File.read!("priv/os_style.json"),
    %{"name" => "Ordinance Survey Vector"},
    fn %{"id" => "esri", "spec" => spec} ->
      %{
        "id" => "os.vector",
        "attribution" => "os",
        "spec" => spec
      }
    end
  )

map =
  Repo.insert!(%Maps.Map{
    owner_id: user.id,
    view_layers: [
      %{
        source_id: satellite_layer_source.id
      },
      %{
        source_id: os_vector_layer_source.id,
        opacity: 0.35
      }
    ],
    features: %{}
  })
