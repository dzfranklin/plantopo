defmodule Mix.Tasks.Test.E2e do
  @moduledoc "Run end-to-end tests"
  alias Mix.Task
  use Task

  @impl Task
  def run([]) do
    shell = Mix.shell()

    Task.run("ecto.drop", ["--quiet"])
    Task.run("ecto.create", ["--quiet"])
    Task.run("ecto.migrate", ["--quiet"])
    Task.run("run", ["priv/repo/seeds.exs"])
    Task.run("run", ["priv/repo/e2e_test_seeds.exs"])

    shell.info("\nRunning end-to-end tests...")
    shell.cmd("npx playwright test", cd: "assets")
  end
end
