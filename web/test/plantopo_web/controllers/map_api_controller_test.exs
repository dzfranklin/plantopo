defmodule PlanTopoWeb.MapApiControllerTest do
  use PlanTopoWeb.ConnCase, async: true
  alias PlanTopo.Maps
  import PlanTopo.{AccountsFixtures, MapsFixtures}

  describe "meta" do
    test "allows owner", %{conn: conn} do
      user = user_fixture()
      map = map_fixture(%{name: "My Map", owner_id: user.id})
      conn = conn |> log_in_user(user) |> get(~p"/api/map/meta?id=#{map.id}")

      assert %{
               "name" => "My Map",
               "id" => map.id,
               "createdAt" => DateTime.to_iso8601(map.inserted_at),
               "owner" => %{
                 "id" => user.id,
                 "name" => user.name,
                 "email" => user.email
               }
             } == json_response(conn, 200)
    end
  end

  test "create general_access unspecified", %{conn: conn} do
    user = user_fixture()

    conn =
      conn
      |> log_in_user(user)
      |> post(~p"/api/map/create", %{name: "My Map"})

    assert %{
             "name" => "My Map",
             "id" => id,
             "owner" => _owner
           } = json_response(conn, 200)

    created = Maps.get_meta!(id)
    assert created.name == "My Map"
    assert created.general_access_level == :restricted
  end

  test "create general_access: public", %{conn: conn} do
    user = user_fixture()

    conn =
      conn
      |> log_in_user(user)
      |> post(~p"/api/map/create", %{
        name: "My Map",
        generalAccessLevel: "public",
        generalAccessRole: "editor"
      })

    assert %{
             "name" => "My Map",
             "id" => id,
             "owner" => _owner
           } = json_response(conn, 200)

    created = Maps.get_meta!(id)
    assert created.name == "My Map"
    assert created.general_access_level == :public
    assert created.general_access_role == :editor
  end

  test "delete", %{conn: conn} do
    user = user_fixture()
    map1 = map_fixture(%{owner_id: user.id})
    map2 = map_fixture(%{owner_id: user.id})
    map3 = map_fixture(%{owner_id: user.id})

    conn = conn |> log_in_user(user) |> delete(~p"/api/map", %{maps: [map1.id, map2.id]})
    assert json_response(conn, 200)

    assert Maps.get_meta(map1.id) == {:error, :not_found}
    assert Maps.get_meta(map2.id) == {:error, :not_found}
    assert {:ok, _} = Maps.get_meta(map3.id)
  end

  test "GET access", %{conn: conn} do
    user1 = user_fixture()
    user2 = user_fixture()
    map = map_fixture(%{owner_id: user1.id})

    Maps.share!(map, user2, :editor)

    :ok =
      Maps.invite(%{
        map_id: map.id,
        email: "fred@example.com",
        role: :editor
      })

    conn = conn |> log_in_user(user1) |> get(~p"/api/map/access", %{id: map.id})

    assert json_response(conn, 200) == %{
             "id" => map.id,
             "owner" => %{"id" => user1.id, "name" => user1.name, "email" => user1.email},
             "generalAccessLevel" => "restricted",
             "generalAccessRole" => "viewer",
             "userAccess" => [
               %{
                 "id" => user2.id,
                 "name" => user2.name,
                 "email" => user2.email,
                 "role" => "editor"
               }
             ],
             "pendingInvites" => [
               %{
                 "email" => "fred@example.com",
                 "role" => "editor"
               }
             ]
           }
  end

  describe "PUT access" do
    test "change general access", %{conn: conn} do
      map = map_fixture()
      user = user_fixture()
      Maps.share!(map, user, :editor)

      assert map.general_access_level == :restricted

      conn =
        conn
        |> log_in_user(user)
        |> put(~p"/api/map/access", %{
          id: map.id,
          generalAccessLevel: "public",
          generalAccessRole: "editor"
        })

      assert json_response(conn, 200)
      updated = Maps.get_meta!(map.id)
      assert updated.general_access_level == :public
      assert updated.general_access_role == :editor
    end

    test "change general access level only", %{conn: conn} do
      map = map_fixture()
      user = user_fixture()
      Maps.share!(map, user, :editor)

      assert map.general_access_level == :restricted

      conn =
        conn
        |> log_in_user(user)
        |> put(~p"/api/map/access", %{
          id: map.id,
          generalAccessLevel: "public"
        })

      assert json_response(conn, 200)
      updated = Maps.get_meta!(map.id)
      assert updated.general_access_level == :public
      assert updated.general_access_role == :viewer
    end

    test "change viewer to editor", %{conn: conn} do
      map = map_fixture()
      me = user_fixture()
      user2 = user_fixture()
      Maps.share!(map, me, :editor)
      Maps.share!(map, user2, :viewer)

      assert {:error, :forbidden} == Maps.check_authorized(user2, map, :edit)

      conn =
        conn
        |> log_in_user(me)
        |> put(~p"/api/map/access", %{
          id: map.id,
          userAccess: [
            %{
              id: user2.id,
              role: "editor"
            }
          ]
        })

      assert json_response(conn, 200)
      assert :ok == Maps.check_authorized(user2, map, :edit)
    end

    test "add new user", %{conn: conn} do
      map = map_fixture()
      me = user_fixture()
      user2 = user_fixture()
      Maps.share!(map, me, :editor)

      assert {:error, :forbidden} == Maps.check_authorized(user2, map, :view)

      conn =
        conn
        |> log_in_user(me)
        |> put(~p"/api/map/access", %{
          id: map.id,
          userAccess: [
            %{
              id: user2.id,
              role: "viewer"
            }
          ]
        })

      assert json_response(conn, 200)
      assert :ok == Maps.check_authorized(user2, map, :view)
    end

    test "remove user", %{conn: conn} do
      map = map_fixture()
      me = user_fixture()
      user2 = user_fixture()
      Maps.share!(map, me, :editor)
      Maps.share!(map, user2, :viewer)

      assert :ok == Maps.check_authorized(user2, map, :view)

      conn =
        conn
        |> log_in_user(me)
        |> put(~p"/api/map/access", %{
          id: map.id,
          userAccess: [
            %{
              id: user2.id,
              role: nil
            }
          ]
        })

      assert json_response(conn, 200)
      assert {:error, :forbidden} == Maps.check_authorized(user2, map, :view)
    end
  end

  describe "invite" do
    test "user that exists", %{conn: conn} do
      me = user_fixture()
      user2 = user_fixture()
      map = map_fixture(%{owner_id: me.id})

      conn =
        conn
        |> log_in_user(me)
        |> post(~p"/api/map/invite", %{
          "mapId" => map.id,
          "email" => user2.email,
          "role" => "editor"
        })

      assert json_response(conn, 200)
      Maps.check_authorized!(user2, map, :edit)
    end

    test "user that does not exist yet", %{conn: conn} do
      me = user_fixture()
      map = map_fixture(%{owner_id: me.id})

      conn =
        conn
        |> log_in_user(me)
        |> post(~p"/api/map/invite", %{
          "mapId" => map.id,
          "email" => "nonexistent@example.com",
          "role" => "editor"
        })

      assert json_response(conn, 200)
    end

    test "as editor", %{conn: conn} do
      me = user_fixture()
      map = map_fixture()
      Maps.share!(map, me, :editor)

      conn =
        conn
        |> log_in_user(me)
        |> post(~p"/api/map/invite", %{
          "mapId" => map.id,
          "email" => "nonexistent@example.com",
          "role" => "editor"
        })

      assert json_response(conn, 200)
    end
  end

  test "rename", %{conn: conn} do
    user = user_fixture()
    map = map_fixture(%{name: "My Map", owner_id: user.id})

    conn =
      conn |> log_in_user(user) |> post(~p"/api/map/rename?id=#{map.id}", %{name: "New name"})

    assert json_response(conn, 200)
    assert Maps.get_meta!(map.id).name == "New name"
  end

  describe "authorize_sync" do
    test "allows unauthenticated if public (view)", %{conn: conn} do
      map = map_fixture(%{general_access_level: :public})

      conn = post(conn, ~p"/api/map/authorize_sync?id=#{map.id}")

      assert %{
               "token" => nil,
               "url" => "wss://localhost/api/map_sync?id=#{map.id}",
               "canEdit" => false
             } ==
               json_response(conn, 200)
    end

    test "allows unauthenticated if public (edit)", %{conn: conn} do
      map = map_fixture(%{general_access_level: :public, general_access_role: :editor})

      conn = post(conn, ~p"/api/map/authorize_sync?id=#{map.id}")

      assert %{
               "token" => nil,
               "url" => "wss://localhost/api/map_sync?id=#{map.id}",
               "canEdit" => true
             } ==
               json_response(conn, 200)
    end

    test "denies unauthenticated if not public", %{conn: conn} do
      map = map_fixture()
      conn = post(conn, ~p"/api/map/authorize_sync?id=#{map.id}")
      assert json_response(conn, 401)
    end

    test "allows owner", %{conn: conn} do
      user = user_fixture()
      map = map_fixture(%{owner_id: user.id})
      conn = conn |> log_in_user(user) |> post(~p"/api/map/authorize_sync?id=#{map.id}")
      assert %{"token" => token} = json_response(conn, 200)
      assert !is_nil(token)
    end

    test "allows shared", %{conn: conn} do
      map = map_fixture()
      user = user_fixture()
      Maps.share!(map, user, :editor)
      conn = conn |> log_in_user(user) |> post(~p"/api/map/authorize_sync?id=#{map.id}")
      assert %{"token" => token} = json_response(conn, 200)
      assert !is_nil(token)
    end

    test "allows shared public", %{conn: conn} do
      map = map_fixture(%{general_access_level: :public})
      user = user_fixture()
      Maps.share!(map, user, :editor)
      conn = conn |> log_in_user(user) |> post(~p"/api/map/authorize_sync?id=#{map.id}")
      assert %{"token" => token} = json_response(conn, 200)
      assert !is_nil(token)
    end

    test "sync token is nil if unauthenticated", %{conn: conn} do
      map = map_fixture(%{general_access_level: :public})
      conn = post(conn, ~p"/api/map/authorize_sync?id=#{map.id}")
      assert %{"token" => nil} = json_response(conn, 200)
    end

    test "sync token is present and valid if shared", %{conn: conn} do
      map = map_fixture()
      user = user_fixture()
      Maps.share!(map, user, :editor)
      conn = conn |> log_in_user(user) |> post(~p"/api/map/authorize_sync?id=#{map.id}")
      assert %{"token" => token} = json_response(conn, 200)
      assert PlanTopo.Sync.verify_user_token_if_present(token) == {:ok, user.id}
    end
  end

  describe "owned_by_me" do
    test "denies unauthenticated", %{conn: conn} do
      conn = get(conn, ~p"/api/map/owned_by_me")
      assert json_response(conn, 401)
    end

    test "handles empty", %{conn: conn} do
      user = user_fixture()
      conn = conn |> log_in_user(user) |> get(~p"/api/map/owned_by_me")
      assert json_response(conn, 200) == []
    end

    test "lists", %{conn: conn} do
      me = user_fixture()
      other_user = user_fixture()

      my_map = map_fixture(%{owner_id: me.id})
      _other_map_unshared = map_fixture(%{owner_id: other_user.id})
      other_map_shared = map_fixture(%{owner_id: other_user.id})
      Maps.share!(other_map_shared, me, :editor)

      conn = conn |> log_in_user(me) |> get(~p"/api/map/owned_by_me")

      assert json_response(conn, 200) == [
               %{
                 "id" => my_map.id,
                 "name" => my_map.name,
                 "createdAt" => DateTime.to_iso8601(my_map.inserted_at),
                 "owner" => %{
                   "id" => me.id,
                   "name" => me.name,
                   "email" => me.email
                 }
               }
             ]
    end
  end

  describe "shared_with_me" do
    test "denies unauthenticated", %{conn: conn} do
      conn = get(conn, ~p"/api/map/shared_with_me")
      assert json_response(conn, 401)
    end

    test "handles empty", %{conn: conn} do
      user = user_fixture()
      conn = conn |> log_in_user(user) |> get(~p"/api/map/shared_with_me")
      assert json_response(conn, 200) == []
    end

    test "lists", %{conn: conn} do
      me = user_fixture()
      other_user = user_fixture()

      _my_map = map_fixture(%{owner_id: me.id})
      _other_map_unshared = map_fixture(%{owner_id: other_user.id})
      other_map_shared = map_fixture(%{owner_id: other_user.id})
      Maps.share!(other_map_shared, me, :editor)

      conn = conn |> log_in_user(me) |> get(~p"/api/map/shared_with_me")

      assert json_response(conn, 200) ==
               [
                 %{
                   "id" => other_map_shared.id,
                   "name" => other_map_shared.name,
                   "createdAt" => DateTime.to_iso8601(other_map_shared.inserted_at),
                   "owner" => %{
                     "id" => other_user.id,
                     "name" => other_user.name,
                     "email" => other_user.email
                   }
                 }
               ]
    end
  end
end
