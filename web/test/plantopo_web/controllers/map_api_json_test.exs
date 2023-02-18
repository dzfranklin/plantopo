defmodule PlanTopoWeb.MapApiJSONTest do
  use PlanTopo.DataCase, async: true
  alias PlanTopoWeb.MapApiJSON
  import PlanTopo.MapFixtures
  import PlanTopo.PaginationFixtures
  import PlanTopo.AccountsFixtures

  def unused_next_mock(_), do: raise("unused_next_mock/1 shouldn't be called")

  setup do
    %{user: user_fixture()}
  end

  describe "view_index/1" do
    test "renders next url" do
      page = page_fixture([])
      render = MapApiJSON.view_index(%{page: page, next: &"http://example.com/?cursor=#{&1}"})
      cursor = page.metadata.after
      assert %{next_url: "http://example.com/?cursor=" <> ^cursor} = render
    end

    test "renders a list of views", %{user: user} do
      view = view_fixture(user, %{name: "View"})
      [layer] = view.layers
      [prop] = layer.prop_overrides
      page = page_fixture([view], nil)

      render = MapApiJSON.view_index(%{page: page, next: &unused_next_mock/1})

      assert render == %{
               data: [
                 %{
                   id: view.id,
                   owner_id: user.id,
                   name: "View",
                   layers: [
                     %{
                       id: layer.id,
                       source_id: layer.source_id,
                       prop_overrides: [
                         %{
                           id: prop.id,
                           layer_id: "bg",
                           property_name: "visibility",
                           value: "hidden"
                         }
                       ]
                     }
                   ],
                   updated_at: view.updated_at
                 }
               ],
               next_url: nil
             }
    end
  end

  describe "source_index/1" do
    test "renders a list of sources" do
      view_source = view_source_fixture(%{name: "Source"})
      source_data = source_data_fixture()

      render =
        MapApiJSON.source_index(%{
          view_source: [view_source],
          source_data: [source_data]
        })

      assert render == %{
               data: %{
                 view_source: [
                   %{
                     id: view_source.id,
                     name: "Source",
                     data_id: view_source.data_id,
                     layers_spec: [],
                     updated_at: view_source.updated_at
                   }
                 ],
                 source_data: [
                   %{
                     id: source_data.id,
                     spec: %{}
                   }
                 ]
               }
             }
    end
  end

  describe "show/1" do
    test "renders a view", %{user: user} do
      view = view_fixture(user, %{name: "View"})
      [layer] = view.layers
      [prop] = layer.prop_overrides

      render = MapApiJSON.show(%{item: view})

      assert render == %{
               data: %{
                 id: view.id,
                 owner_id: user.id,
                 name: "View",
                 layers: [
                   %{
                     id: layer.id,
                     source_id: layer.source_id,
                     prop_overrides: [
                       %{
                         id: prop.id,
                         layer_id: "bg",
                         property_name: "visibility",
                         value: "hidden"
                       }
                     ]
                   }
                 ],
                 updated_at: view.updated_at
               }
             }
    end
  end
end
