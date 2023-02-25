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
alias Maps.{LayerData, LayerSource}

{:ok, user} =
  Accounts.register_user(%{
    email: "test@example.com",
    username: "test",
    password: "testpassword"
  })

# TODO: Add some kind of vector streets

terrain =
  Repo.insert!(%LayerData{
    id: "terrain",
    spec: %{
      type: "raster-dem",
      encoding: "terrarium",
      maxzoom: 15,
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
      ],
      attribution:
        ~S[
          Terrain Tiles from <a href="https://registry.opendata.aws/terrain-tiles">https://registry.opendata.aws/terrain-tiles</a>.
          ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736;
          Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017;
          Austria terrain data © offene Daten Österreichs &ndash; Digitales Geländemodell (DGM) Österreich;
          Canada terrain data contains information licensed under the Open Government Licence &ndash; Canada;
          Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers;
          Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration * Mexico terrain data source: INEGI, Continental relief, 2016;
          New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved);
          Norway terrain data © Kartverket;
          United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved;
          United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.
        ]
        |> String.trim()
        |> String.split("\n")
        |> Enum.map(&String.trim/1)
        |> Enum.join(" ")
    }
  })

satellite_data =
  Repo.insert!(%LayerData{
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

Repo.insert!(%LayerSource{
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

Repo.insert(%LayerSource{
  name: "Hillshading",
  default_opacity: 0.25,
  dependencies: [terrain],
  layer_specs: [
    %{
      id: "layer",
      source: terrain.id,
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
