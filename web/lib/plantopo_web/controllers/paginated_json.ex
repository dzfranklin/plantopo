defmodule PlanTopoWeb.PaginatedJSON do
  @doc """
  Renders a Paginator.Page into

  ```json
  {
    data: [...],
    next_url: "https://..."
  }
  ```

  ## Options

  - next: Turns an after cursor into a url. Required.
  - each: Transforms each entry. Optional.
  """
  def paginated(%Paginator.Page{metadata: meta, entries: entries}, opts) do
    next = Keyword.fetch!(opts, :next)
    each = Keyword.get(opts, :each, & &1)

    %{
      data: for(entry <- entries, do: each.(entry)),
      next_url: meta.after && next.(meta.after)
    }
  end
end
