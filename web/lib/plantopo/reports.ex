defmodule PlanTopo.Reports do
  alias PlanTopo.Repo
  alias __MODULE__.LayerDataRequest

  def insert_layer_data_requests!(alleged_user_id, requests) do
    Repo.transaction!(fn ->
      for %{"url" => url, "at" => at} <- requests do
        parsed = URI.parse(url)
        [path_seg_1, path_seg_2] = parse_path_segments(parsed.path)

        %{
          alleged_user_id: alleged_user_id,
          at: DateTime.from_unix!(at, :millisecond),
          url: url,
          host: parsed.host,
          path: parsed.path,
          path_seg_1: path_seg_1,
          path_seg_2: path_seg_2
        }
        |> LayerDataRequest.changeset()
        |> Repo.insert!()
      end
    end)
  end

  defp parse_path_segments(path) do
    parts =
      path
      |> String.trim_leading("/")
      |> String.split("/")

    [
      nilify_empty_str(Enum.at(parts, 0)),
      nilify_empty_str(Enum.at(parts, 1))
    ]
  end

  defp nilify_empty_str(""), do: nil
  defp nilify_empty_str(s), do: s
end
