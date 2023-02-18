defmodule PlanTopo.AuthError do
  defexception []

  @impl true
  def exception([]), do: %__MODULE__{}

  @impl true
  def message(_), do: "Auth Error"
end
