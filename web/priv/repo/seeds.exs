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
alias Maps.{ViewAt, ViewDataSource, ViewLayerSource, ViewLayer, View}

{:ok, user} =
  Accounts.register_user(%{
    email: "test@example.com",
    password: "testpassword"
  })

satellite_data =
  Repo.insert!(%ViewDataSource{
    id: "mapbox.satellite",
    credit_os: false,
    spec: %{
      type: "raster",
      tiles: [
        "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90"
      ],
      maxzoom: 21,
      attribution:
        ~S[© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>]
    }
  })

satellite_layer_source =
  Repo.insert!(%ViewLayerSource{
    name: "Satellite",
    dependencies: [satellite_data],
    layer_specs: [
      %{
        id: "layer",
        source: "mapbox.satellite",
        type: "raster"
      }
    ]
  })

Repo.insert!(%View{
  owner_id: nil,
  name: "Satellite",
  layers: [
    %{
      source_id: satellite_layer_source.id,
      prop_overrides: []
    }
  ]
})

os_vector_layer_source =
  Maps.import_mapbox_style!(
    File.read!("priv/os_style.json"),
    %{"name" => "Ordinance Survey Vector"},
    fn %{"id" => "esri", "spec" => spec} ->
      %{
        "id" => "os.vector",
        "credit_os" => true,
        "spec" => spec
      }
    end
  )

Repo.insert!(%View{
  owner_id: nil,
  name: "Ordinance Survey Vector",
  layers: [
    %{
      source_id: os_vector_layer_source.id,
      prop_overrides: []
    }
  ]
})

hybrid_view =
  Repo.insert!(%View{
    owner_id: nil,
    name: "Ordinance Survey Hybrid Vector",
    layers: [
      %{
        source_id: satellite_layer_source.id,
        prop_overrides: []
      },
      %{
        source_id: os_vector_layer_source.id,
        opacity: 0.12,
        prop_overrides: [
          %{
            comment: "Covers up the area outside the bbox",
            layer_id: "background",
            property_category: "layout",
            property_name: "visibility",
            value: "none"
          },
          # %{
          #   comment: "Ocean",
          #   layer_id: "background",
          #   property_cateogry: "paint",
          #   property_name: "fill-opacity",
          #   value: 0.6
          # },
          %{
            layer_id: "European_land/1",
            property_category: "paint",
            property_name: "fill-opacity",
            value: 0
          }
        ]
      }
    ]
  })

map =
  Repo.insert!(%Maps.Map{
    owner_id: user.id,
    view_id: hybrid_view.id,
    features: %{}
  })
