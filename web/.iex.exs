alias PlanTopo.{Accounts, Accounts.User, Repo, Maps}

defmodule IexHelpers do
  def recompile_frontend do
    Tailwind.run(:default, [])
    Esbuild.run(:default, [])
  end
end

import IexHelpers
