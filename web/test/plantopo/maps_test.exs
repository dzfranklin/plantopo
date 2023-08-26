defmodule PlanTopo.MapsTest do
  use PlanTopo.DataCase, async: true

  alias PlanTopo.Maps
  import PlanTopo.{AccountsFixtures, MapsFixtures}

  test "get meta" do
    map = map_fixture()
    assert map == Maps.get_meta!(map.id)
  end

  describe "authorization" do
    test "denies unrelated user" do
      map = map_fixture()
      user = user_fixture()
      assert {:error, :forbidden} = Maps.check_authorized(user.id, map, :edit)
    end

    test "allows owner" do
      user = user_fixture()
      map = map_fixture(%{owner_id: user.id})
      assert :ok = Maps.check_authorized(user.id, map, :edit)
    end

    test "non-owner can be authorized" do
      user = user_fixture()
      map = map_fixture(%{owner_id: user.id})
      user2 = user_fixture()
      Maps.share!(map, user2, :editor)
      assert :ok = Maps.check_authorized(user2.id, map, :edit)
    end

    test "authorizing owner works" do
      user = user_fixture()
      map = map_fixture(%{owner_id: user.id})
      Maps.share!(map, user, :editor)
      assert :ok = Maps.check_authorized(user.id, map, :edit)
    end

    test "public" do
      map = map_fixture(%{general_access_level: :public})
      user = user_fixture()

      assert :ok = Maps.check_authorized(user.id, map, :view)
      assert {:error, _} = Maps.check_authorized(user.id, map, :edit)

      {:ok, map} = Maps.set_general_access_role(map, :editor)
      assert :ok = Maps.check_authorized(user.id, map, :edit)
    end
  end
end
