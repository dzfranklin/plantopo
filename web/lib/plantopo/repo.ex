defmodule PlanTopo.Repo do
  use Ecto.Repo,
    otp_app: :plantopo,
    adapter: Ecto.Adapters.Postgres

  use Paginator,
    limit: 100,
    maximum_limit: 100,
    include_total_count: false,
    total_count_primary_key_field: :id

  def transaction!(fun_or_multi, opts \\ []) do
    {:ok, value} = transaction(fun_or_multi, opts)
    value
  end
end
