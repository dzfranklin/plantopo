defmodule PlanTopoWeb.MapControllerTest do
  use PlanTopoWeb.ConnCase, async: true

  setup :register_and_log_in_user

  test "loads", %{conn: conn} do
    conn = get(conn, ~p"/map")
    resp = html_response(conn, 200)
    assert resp =~ ~S[src="/assets/map.js"]
    assert resp =~ ~S[href="/assets/map.css"]
    assert resp =~ ~S[<div id="map-app"]
  end
end
