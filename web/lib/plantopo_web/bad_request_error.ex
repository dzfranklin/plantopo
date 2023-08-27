defmodule PlanTopoWeb.BadRequestError do
  defexception [:message, plug_status: 400]
end
