defmodule PlanTopoWeb.ErrorJSONTest do
  use PlanTopoWeb.ConnCase, async: true

  def render(template), do: PlanTopoWeb.ErrorJSON.render(template, %{})

  test "renders 404" do
    assert render("404.json") == %{errors: %{message: "Not Found"}}
  end

  test "renders 500" do
    assert render("500.json") ==
             %{errors: %{message: "Internal Server Error"}}
  end

  test "renders 301" do
    assert render("401.json") == %{errors: %{message: "Unauthorized"}}
  end
end
