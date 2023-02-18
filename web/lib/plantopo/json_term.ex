defmodule PlanTopo.JSONTerm do
  alias Ecto.Type
  use Type

  @impl Type
  def type, do: :any_json

  @impl Type
  def cast(value), do: {:ok, value}

  @impl Type
  def load(value), do: Jason.decode(value)

  @impl Type
  def dump(value), do: Jason.encode(value)
end
