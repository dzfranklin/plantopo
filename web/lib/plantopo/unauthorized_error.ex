defmodule PlanTopo.UnauthorizedError do
  defexception [:message, plug_status: 401]
end
