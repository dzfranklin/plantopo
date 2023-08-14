defmodule PlanTopo.Maps.GpxImporter do
  import SweetXml

  @moduledoc """
  The explore.garmin.com exporter seems inconsistently broken. This is tested
  against a single activity exported through the Explore Android app.
  """

  def import!(gpx_doc) do
    gpx_doc
    |> parse(dtd: :none)
    |> xmap(
      meta: [
        ~x"./metadata"o,
        name: ~x"./name/text()"s,
        time: ~x"./time/text()"s |> transform_by(&parse_datetime!/1)
      ],
      tracks: [
        ~x"//trk"l,
        name: ~x"./name/text()"s,
        points: [
          ~x".//trkpt"l,
          lat: ~x"./@lat"f,
          lon: ~x"./@lon"f,
          ele: ~x"./ele/text()"of,
          time: ~x"./time/text()"s |> transform_by(&parse_datetime!/1)
        ]
      ]
    )
  end

  defp parse_datetime!(s) do
    if String.length(s) == 0 do
      nil
    else
      case DateTime.from_iso8601(s) do
        {:ok, dt, _offset} -> dt
        {:error, err} -> raise "#{inspect(err)}: failed to parse #{inspect(s)}"
      end
    end
  end
end
