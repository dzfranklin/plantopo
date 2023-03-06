defmodule PlanTopo.Reports do
  alias PlanTopo.Repo
  alias __MODULE__.TileLoadReport

  def report_tile_loads!(alleged_user_id, requests) do
    Logger.put_process_level(self(), :info)

    Repo.transaction!(fn ->
      for req <- requests do
        req
        |> Map.update!("at", &DateTime.from_unix!(&1, :millisecond))
        |> Map.put("alleged_user_id", alleged_user_id)
        |> TileLoadReport.changeset()
        |> Repo.insert!()
      end
    end)
  end
end
