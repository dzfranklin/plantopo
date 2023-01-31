Rexbug.start("ExUnit.Server.add_sync_module/_",
  print_fun: fn
    {:call, {{ExUnit.Server, :add_sync_module, [mod]}, _}, _, _} ->
      IO.write("\nAdded sync test module: #{mod}\n")

    _ ->
      nil
  end
)

ExUnit.start()
Ecto.Adapters.SQL.Sandbox.mode(PlanTopo.Repo, :manual)
