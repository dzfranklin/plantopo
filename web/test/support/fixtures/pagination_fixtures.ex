defmodule PlanTopo.PaginationFixtures do
  def page_fixture(entries, after_cursor \\ cursor_fixture()) do
    %Paginator.Page{
      metadata: %Paginator.Page.Metadata{
        after: after_cursor
      },
      entries: entries
    }
  end

  def cursor_fixture do
    Paginator.Cursor.encode(%{
      example_col: 42
    })
  end
end
