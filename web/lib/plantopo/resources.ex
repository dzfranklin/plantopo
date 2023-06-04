defmodule PlanTopo.Resources do
  @spec value :: iodata()
  def value do
    %{
      layerData:
        [
          terrain_data(),
          satellite_data(),
          tnm_data(),
          os_vector_data()
        ]
        |> Enum.into(%{}, &{&1.id, &1}),
      layerSource:
        [
          satellite_source(),
          hillshading_source(),
          os_vector_source(),
          tnm_source()
        ]
        |> Enum.into(%{}, &{&1.id, &1})
    }
    |> Jason.encode_to_iodata!()
  end

  # Layer Data

  defp terrain_data do
    %{
      id: "L710d828a-e630-11ed-9be0-7f7ca8a57538",
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
          |> fixup_attrib()
      }
    }
  end

  defp satellite_data do
    %{
      id: "L581317ec-7ec2-4cbc-b4d9-f7884e4ba678",
      spec: %{
        type: "raster",
        tiles: [
          "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90"
        ],
        maxzoom: 21,
        attribution: ~S[
          © <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>
          <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>
        ] |> fixup_attrib()
      }
    }
  end

  defp tnm_data do
    %{
      id: "L34499fc7-374e-429f-9391-63edbf7a2f2e",
      spec: %{
        type: "raster",
        tiles: [
          "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/WMTS/tile/1.0.0/USGSTopo/default/GoogleMapsCompatible/{z}/{y}/{x}.png"
        ],
        tileSize: 256,
        maxzoom: 16,
        bounds: [
          -2.003750785759102e7,
          -3.0242455261924103e7,
          2.003872561259901e7,
          3.0240972179360494e7
        ],
        attribution:
          ~S[
            USGS The National Map: National Boundaries Dataset, 3DEP Elevation Program, Geographic Names Information System, National Hydrography Dataset, National Land
            Cover Database, National Structures Dataset, and National Transportation Dataset; USGS Global Ecosystems; U.S. Census Bureau TIGER/Line data; USFS Road Data;
            Natural Earth Data; U.S. Department of State Humanitarian Information Unit; and NOAA National Centers for Environmental Information, U.S. Coastal Relief Model.
          ]
          |> fixup_attrib()
      }
    }
  end

  defp os_vector_data do
    %{
      id: "Lc5fab96a-ab9f-4b43-acb9-3d85dd9529a0",
      spec: %{
        type: "vector",
        url: "https://api.os.uk/maps/vector/v1/vts?key=",
        attribution:
          "<!-- OS_LOGO -->Contains OS data &copy; Crown copyright and database rights #{Date.utc_today().year}"
      }
    }
  end

  # Layer Sources

  defp satellite_source do
    %{
      id: "L305639a3-8a47-47dc-8b16-76a8b90f0e6c",
      name: "Satellite",
      layerSpecs: [
        %{
          id: "layer",
          source: "L581317ec-7ec2-4cbc-b4d9-f7884e4ba678",
          type: "raster"
        }
      ]
    }
  end

  defp hillshading_source do
    %{
      id: "Ld29e17e8-5406-40ea-a9dd-d3d4f77426c1",
      name: "Hillshading",
      defaultOpacity: 0.25,
      layerSpecs: [
        %{
          id: "layer",
          source: "L710d828a-e630-11ed-9be0-7f7ca8a57538",
          type: "hillshade",
          paint: %{
            "hillshade-shadow-color": "rgba(0, 0, 0, 0.2)",
            "hillshade-accent-color": "rgba(0, 0, 0, 0)",
            "hillshade-highlight-color": "rgba(0, 0, 0, 0)"
          }
        }
      ]
    }
  end

  @os_vector_source_layers "priv/os_vector_source_layers.json" |> File.read!() |> Jason.decode!()

  defp os_vector_source do
    %{
      id: "L32b3de92-9c9c-4cf7-9289-d5e6246b4277",
      name: "Ordinance Survey Vector",
      layerSpecs: @os_vector_source_layers,
      sprite: "https://api.os.uk/maps/vector/v1/vts/resources/sprites/sprite?key="
    }
  end

  defp tnm_source do
    %{
      id: "L7bb4c5ca-ef7f-455a-a797-9480513e6269",
      name: "USGS Topo",
      layerSpecs: [
        %{
          id: "layer",
          source: "L34499fc7-374e-429f-9391-63edbf7a2f2e",
          type: "raster"
        }
      ]
    }
  end

  defp fixup_attrib(value) do
    value
    |> String.trim()
    |> String.split("\n")
    |> Enum.map(&String.trim/1)
    |> Enum.join(" ")
  end
end
