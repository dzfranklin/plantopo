# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     PlanTopo.Repo.insert!(%PlanTopo.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.
_user =
  case PlanTopo.Accounts.get_user_by_email("test@example.com") do
    nil ->
      {:ok, user} =
        PlanTopo.Accounts.register_user(%{
          email: "test@example.com",
          username: "test",
          password: "testpassword"
        })

      user

    user ->
      user
  end
