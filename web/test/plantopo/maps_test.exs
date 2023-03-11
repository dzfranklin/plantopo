defmodule PlanTopo.MapsTest do
  alias PlanTopo.Maps
  alias Maps.HistorySave
  use PlanTopo.DataCase, async: true
  import PlanTopo.AccountsFixtures
  import PlanTopo.MapsFixtures

  describe "autosave" do
    test "doesn't promote prev to history if less than interval ago" do
      user = user_fixture()
      map = map_fixture(user)

      valid_autosave_attributes(
        map,
        %{saved_at: DateTime.utc_now() |> DateTime.add(-30, :minute)}
      )
      |> Maps.autosave()

      assert Maps.list_all_history_saves(map.id) |> length() == 0

      # The first autosave is automatically promoted
      valid_autosave_attributes(
        map,
        %{saved_at: DateTime.utc_now() |> DateTime.add(-25, :minute)}
      )
      |> Maps.autosave()

      assert Maps.list_all_history_saves(map.id) |> length() == 1

      valid_autosave_attributes(
        map,
        %{saved_at: DateTime.utc_now() |> DateTime.add(-5, :minute)}
      )
      |> Maps.autosave()

      assert Maps.list_all_history_saves(map.id) |> length() == 1
    end

    test "promotes prev to history if more than interval ago" do
      user = user_fixture()
      map = map_fixture(user)

      valid_autosave_attributes(
        map,
        %{saved_at: DateTime.utc_now() |> DateTime.add(-120, :minute)}
      )
      |> Maps.autosave()

      assert Maps.list_all_history_saves(map.id) |> length() == 0

      hx_saved_at = DateTime.utc_now() |> DateTime.add(-50, :minute) |> DateTime.truncate(:second)

      # The first autosave is automatically promoted
      valid_autosave_attributes(
        map,
        %{saved_at: hx_saved_at}
      )
      |> Maps.autosave()

      assert [%HistorySave{id: first_id}] = Maps.list_all_history_saves(map.id)

      valid_autosave_attributes(
        map,
        %{saved_at: DateTime.utc_now() |> DateTime.add(-5, :minute)}
      )
      |> Maps.autosave()

      assert [first, hx_save] = Maps.list_all_history_saves(map.id)
      assert first.id == first_id
      assert hx_save.map_id == map.id
      assert hx_save.saved_at == hx_saved_at
    end
  end
end
