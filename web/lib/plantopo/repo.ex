defmodule PlanTopo.Repo do
  use Ecto.Repo,
    otp_app: :plantopo,
    adapter: Ecto.Adapters.Postgres
end
