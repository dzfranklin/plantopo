alias PlanTopo.Accounts

{:ok, _} = Accounts.register_user(%{
  email: "test@example.com",
  password: "testpassword"
})
