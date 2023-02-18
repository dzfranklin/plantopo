defmodule PlanTopoWeb.MapApiControllerTest do
  use PlanTopoWeb.ConnCase, async: true
  alias PlanTopo.{Maps, Maps.Views.View}
  import PlanTopo.{MapFixtures, AccountsFixtures}

  @view_update_params %{
    name: "Updated Name"
  }

  setup :accept_json
  setup :register_and_log_in_user

  defp create_view(%{user: user}) do
    view = view_fixture(user)
    %{view: view}
  end

  describe "list_default_view" do
    test "renders empty list if no views", %{conn: conn} do
      conn = get(conn, ~p"/api/map/view/default")
      assert json_response(conn, 200) == %{"data" => [], "next_url" => nil}
    end

    test "lists multiple pages", %{conn: conn} do
      Enum.map(0..101, fn _ -> default_view_fixture() end)
      conn = get(conn, ~p"/api/map/view/default")

      resp = json_response(conn, 200)
      assert length(resp["data"]) == 100
      assert resp["next_url"] =~ ~r/^http.*\?cursor=/

      conn = get(conn, resp["next_url"])

      resp = json_response(conn, 200)
      assert is_nil(resp["next_url"])
      assert length(resp["data"]) == 2
    end

    test "doesn't list a non-default view", %{conn: conn, user: user} do
      view_fixture(user)

      conn = get(conn, ~p"/api/map/view/default")
      assert %{"data" => [], "next_url" => nil} = json_response(conn, 200)
    end
  end

  describe "list_user_view" do
    test "renders empty list if no views", %{conn: conn} do
      conn = get(conn, ~p"/api/map/view/default")
      assert json_response(conn, 200) == %{"data" => [], "next_url" => nil}
    end

    test "lists multiple pages", %{conn: conn, user: user} do
      Enum.map(0..101, fn _ -> view_fixture(user) end)
      conn = get(conn, ~p"/api/map/view/user")

      resp = json_response(conn, 200)
      assert resp["next_url"] =~ ~r/^http.*\?cursor=/
      assert length(resp["data"]) == 100
      assert !is_nil(resp["next_url"])

      conn = get(conn, resp["next_url"])

      resp = json_response(conn, 200)
      assert is_nil(resp["next_url"])
      assert length(resp["data"]) == 2
    end

    test "doesn't list a default view", %{conn: conn} do
      default_view_fixture()

      conn = get(conn, ~p"/api/map/view/user")
      assert %{"data" => [], "next_url" => nil} = json_response(conn, 200)
    end

    test "doesn't list a view belonging to another user", %{conn: conn} do
      other_user = user_fixture()
      view_fixture(other_user)

      conn = get(conn, ~p"/api/map/view/user")
      assert %{"data" => [], "next_url" => nil} = json_response(conn, 200)
    end
  end

  describe "create_user_view" do
    test "works when valid", %{conn: conn, user: user} do
      conn = post(conn, ~p"/api/map/view/user", view: valid_view_attributes())
      assert %{"data" => %{"id" => id}} = json_response(conn, 201)
      assert %View{} = s.get_view!(user, id)
    end

    test "renders errors when invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/map/view/user", view: %{})
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update_user_view" do
    setup [:create_view]

    test "works when valid", %{conn: conn, user: user, view: %View{id: id} = view} do
      conn = put(conn, ~p"/api/map/view/user/#{view}", view: %{name: "Name #2"})
      assert %{"data" => %{"id" => ^id}} = json_response(conn, 200)
      assert %View{name: "Name #2"} = Maps.get_view!(user, id)
    end

    test "renders errors when invalid", %{conn: conn, view: view} do
      conn = put(conn, ~p"/api/map/view/user/#{view}", view: %{name: ""})
      assert json_response(conn, 422)["errors"] != %{}
    end

    test "404s when the view doesn't exist", %{conn: conn} do
      assert_error_sent 404, fn ->
        put(conn, ~p"/api/map/view/user/42", view: @view_update_params)
      end
    end

    test "404s when the view belongs to another user", %{conn: conn} do
      other_user = user_fixture()
      view = view_fixture(other_user)

      assert_error_sent 404, fn ->
        put(conn, ~p"/api/map/view/user/#{view}", view: @view_update_params)
      end
    end
  end

  describe "delete_user_view" do
    setup [:create_view]

    test "works when valid", %{conn: conn, user: user, view: view} do
      conn = delete(conn, ~p"/api/map/view/user/#{view}")
      assert response(conn, 204)
      assert_raise Ecto.NoResultsError, fn -> Maps.get_view!(user, view.id) end
    end

    test "404s when the view doesn't exist", %{conn: conn} do
      assert_error_sent 404, fn ->
        delete(conn, ~p"/api/map/view/user/42")
      end
    end

    test "404s when the view belongs to another user", %{conn: conn} do
      other_user = user_fixture()
      view = view_fixture(other_user)

      assert_error_sent 404, fn ->
        delete(conn, ~p"/api/map/view/user/#{view}", %{name: "Name #2"})
      end
    end
  end

  describe "list_source" do
    test "lists both view sources and source data", %{conn: conn} do
      # Note: view_source_fixture also creates a unique source data for each
      Enum.map(0..9, fn _ -> view_source_fixture() end)
      conn = get(conn, ~p"/api/map/source")

      data = json_response(conn, 200)["data"]
      assert length(data["view_source"]) == 10
      assert length(data["source_data"]) == 10
    end
  end
end
