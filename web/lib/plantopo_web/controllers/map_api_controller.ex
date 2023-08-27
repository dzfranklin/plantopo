defmodule PlanTopoWeb.MapApiController do
  use PlanTopoWeb, :controller
  alias PlanTopo.Maps
  alias PlanTopo.UnauthorizedError

  action_fallback(PlanTopoWeb.FallbackController)

  def meta(conn, %{"id" => id}) do
    map = Maps.get_meta!(id, preload_owner: true)
    Maps.check_authorized!(conn.assigns.current_user, map, :view)
    render(conn, %{meta: map})
  end

  def create(conn, params) do
    user = conn.assigns.current_user
    if is_nil(user), do: raise(UnauthorizedError, "must sign in to create map")

    params =
      params
      |> keys_to_snake_case()
      |> Map.delete("owner")
      |> Map.put("owner_id", user.id)
      |> Enum.reject(fn {_, v} -> is_nil(v) end)
      |> Enum.into(%{})

    with {:ok, map} <- Maps.create(params, preload_owner: true) do
      render(conn, :meta, %{meta: map})
    end
  end

  def rename(conn, %{"id" => id, "name" => name}) do
    map = Maps.get_meta!(id)
    Maps.check_authorized!(conn.assigns.current_user, map, :edit)

    with {:ok, _} <- Maps.rename(map, name) do
      render(conn, :ok)
    end
  end

  def access(conn, %{"id" => id}) do
    map = Maps.get_meta!(id, preload_owner: true)
    Maps.check_authorized!(conn.assigns.current_user, map, :view)
    user_access = Maps.user_access(map)

    render(conn, %{
      id: map.id,
      general_access_level: map.general_access_level,
      general_access_role: map.general_access_role,
      owner: map.owner,
      user_access: user_access,
      pending_invites: Maps.pending_invites(map)
    })
  end

  def put_access(conn, %{"id" => id} = params) do
    map = Maps.get_meta!(id)
    Maps.check_authorized!(conn.assigns.current_user, map, :share)

    general_access_level = params["generalAccessLevel"]
    general_access_role = params["generalAccessRole"]
    user_access = Map.get(params, "userAccess", [])

    if !is_nil(general_access_level) do
      {:ok, _} = Maps.set_general_access_level(map, general_access_level)
      nil
    end

    if !is_nil(general_access_role) do
      {:ok, _} = Maps.set_general_access_role(map, general_access_role)
      nil
    end

    Enum.each(user_access, fn entry ->
      user_id = Map.fetch!(entry, "id")
      role = Map.get(entry, "role")

      if is_nil(role) do
        Maps.unshare(map, user_id)
      else
        Maps.share!(map, user_id, role)
      end
    end)

    render(conn, :ok)
  end

  def invite(conn, params) do
    params = keys_to_snake_case(params)

    with :ok <- Maps.invite(params) do
      render(conn, :ok)
    end
  end

  def delete(conn, %{"maps" => maps}) do
    Enum.each(maps, fn id ->
      map = Maps.get_meta!(id)
      Maps.check_authorized!(conn.assigns.current_user, map, :delete)
    end)

    :ok = Maps.delete_all(maps)

    render(conn, :ok)
  end

  def authorize_sync(conn, %{"id" => id}) do
    map = Maps.get_meta!(id)
    user = conn.assigns.current_user

    with :ok <- Maps.check_authorized(user, map, :view) do
      can_edit = Maps.check_authorized(user, map, :edit) == :ok

      token =
        if not is_nil(user) do
          PlanTopo.Sync.mint_user_token(user)
        end

      url = PlanTopo.Sync.socket_url(map.id)

      render(conn, %{
        token: token,
        url: url,
        can_edit: can_edit
      })
    end
  end

  def owned_by_me(conn, _) do
    user = conn.assigns.current_user

    if is_nil(user) do
      {:error, :unauthorized}
    else
      list = Maps.list_owned(user)
      render(conn, :list, %{list: list})
    end
  end

  def shared_with_me(conn, _) do
    user = conn.assigns.current_user

    if is_nil(user) do
      {:error, :unauthorized}
    else
      list = Maps.list_shared_with(user)
      render(conn, :list, %{list: list})
    end
  end
end
