defmodule PlanTopoWeb.DevSyncInspectorController do
  use PlanTopoWeb, :controller

  def post(conn, _params) do
    {:ok, body, conn} = read_body(conn)

    result =
      Porcelain.exec("pt-sync-inspector", ["--type", "sync", "--decode"],
        in: body,
        out: :iodata,
        err: :string
      )

    if result.status == 0 do
      resp(conn, 200, result.out)
    else
      resp(conn, 400, result.err)
    end
  end
end
