defmodule PlanTopoWeb.MapsLive do
  use PlanTopoWeb, :live_view
  alias PlanTopo.Maps

  def render(assigns) do
    ~H"""
    <.header>My maps</.header>

    <ul>
      <.button phx-click="create">Create</.button>

      <%= for map <- @owned do %>
        <.map_entry map={map} />
      <% end %>
    </ul>

    <.header>Shared with me</.header>

    <ul>
      <%= for map <- @shared do %>
        <li>
          <.map_entry map={map} />
        </li>
      <% end %>
    </ul>
    """
  end

  def map_entry(assigns) do
    ~H"""
    <li>
      <a href={~p"/map/#{@map}"}>
        <%= @map.name || "Unnamed map" %>
      </a>
    </li>
    """
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_user

    owned = Maps.list_owned_by(user)
    shared = Maps.list_shared_with(user)

    {:ok, assign(socket, owned: owned, shared: shared)}
  end

  def handle_event("create", _params, socket) do
    map = Maps.create!(socket.assigns.current_user, %{})
    {:noreply, redirect(socket, to: ~p"/map/#{map}")}
  end
end
