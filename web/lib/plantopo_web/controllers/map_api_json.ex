defmodule PlanTopoWeb.MapApiJSON do
  alias PlanTopo.Maps

  def ok(_), do: %{status: "ok"}

  def meta(%{meta: %Maps.Meta{id: id, name: name, inserted_at: inserted_at, owner: owner}}) do
    %{
      "id" => id,
      "name" => name || "",
      "createdAt" => DateTime.to_iso8601(inserted_at),
      "owner" => public_user(owner)
    }
  end

  def access(%{
        id: id,
        general_access_level: general_access_level,
        general_access_role: general_access_role,
        owner: owner,
        user_access: user_access,
        pending_invites: pending_invites
      }) do
    %{
      "id" => id,
      "owner" => public_user(owner),
      "generalAccessLevel" => general_access_level(general_access_level),
      "generalAccessRole" => role(general_access_role),
      "userAccess" =>
        Enum.map(user_access, fn access ->
          public_user(access.user)
          |> Map.put("role", role(access.role))
        end),
      "pendingInvites" =>
        Enum.map(pending_invites, fn invite ->
          %{
            "email" => invite.email,
            "role" => role(invite.role)
          }
        end)
    }
  end

  def list(%{list: list}) do
    Enum.map(list, &meta(%{meta: &1}))
  end

  def authorize_sync(%{token: token, url: url, can_edit: can_edit}) do
    %{
      "token" => token,
      "url" => url,
      "canEdit" => can_edit
    }
  end

  def sync_client_name(%{name: name}) do
    %{
      "name" => name
    }
  end

  def tokens(%{tokens: tokens}) do
    tokens
  end

  defp public_user(%{id: id, name: name, email: email}),
    do: %{id: id, name: name, email: email}

  defp role(:editor), do: "editor"
  defp role(:viewer), do: "viewer"

  defp general_access_level(:public), do: "public"
  defp general_access_level(:restricted), do: "restricted"
end
