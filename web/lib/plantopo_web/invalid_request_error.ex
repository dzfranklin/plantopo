defmodule PlanTopoWeb.InvalidRequestError do
  defexception [:message, plug_status: 400]
end
