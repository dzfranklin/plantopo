defmodule PlanTopoWeb.SyncServerControllerTest do
  use PlanTopoWeb.ConnCase, async: true
  import PlanTopo.MapsFixtures
  alias PlanTopo.{Maps, Sync}

  describe "POST snapshot" do
    test "not bearer auth header", %{conn: conn} do
      map = map_fixture()

      assert_error_sent(400, fn ->
        post(conn, "/api/sync_server/snapshot", %{
          map_id: map.id,
          value: %{
            contents_of_value_arent_parsed: 42
          }
        })
      end)

      assert_error_sent(400, fn ->
        conn
        |> put_req_header("authorization", "foo")
        |> post("/api/sync_server/snapshot", %{
          map_id: map.id,
          value: %{
            contents_of_value_arent_parsed: 42
          }
        })
      end)
    end

    test "invalid auth header", %{conn: conn} do
      map = map_fixture()

      assert_error_sent(403, fn ->
        conn
        |> put_req_header("authorization", "Bearer foo")
        |> post("/api/sync_server/snapshot", %{
          map_id: map.id,
          value: %{
            contents_of_value_arent_parsed: 42
          }
        })
      end)
    end

    test "valid", %{conn: conn} do
      map = map_fixture()
      token = Sync.mint_server_snapshot_token()

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{token}")
        |> post("/api/sync_server/snapshot", %{
          map_id: map.id,
          value: %{
            contents_of_value_arent_parsed: 42
          }
        })

      assert conn.status == 200

      actual = Maps.latest_snapshot(map)
      assert actual.value == %{"contents_of_value_arent_parsed" => 42}
    end

    test "invalid", %{conn: conn} do
      map = map_fixture()
      token = Sync.mint_server_snapshot_token()

      assert_error_sent(400, fn ->
        conn
        |> put_req_header("authorization", "Bearer #{token}")
        |> post("/api/sync_server/snapshot", %{
          map_id: map.id
        })
      end)
    end
  end
end
