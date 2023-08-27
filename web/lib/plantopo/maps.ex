defmodule PlanTopo.Maps do
  @moduledoc """
  The Maps context.
  """
  alias __MODULE__.{Meta, Access, PendingInvite, Snapshot}
  alias PlanTopo.Repo
  alias PlanTopo.Accounts
  alias PlanTopo.Accounts.User
  import Ecto.Query
  alias Ecto.Changeset
  require Logger
  alias PlanTopo.{ForbiddenError, UnauthorizedError, NotFoundError}

  @type role :: :editor | :viewer | String.t()
  @type general_access_level :: :public | :restricted | String.t()

  def get_meta!(id, opts \\ []) do
    case get_meta(id, opts) do
      {:ok, meta} -> meta
      {:error, :not_found} -> raise NotFoundError, message: "map not found"
    end
  end

  @spec get_meta(number(), Keyword.t()) :: {:ok, Meta.t()} | {:error, :not_found}
  def get_meta(id, opts \\ []) do
    value =
      Meta
      |> where(id: ^id, is_deleted: false)
      |> Repo.one()

    if is_nil(value) do
      {:error, :not_found}
    else
      if Keyword.get(opts, :preload_owner) do
        {:ok, Repo.preload(value, :owner)}
      else
        {:ok, value}
      end
    end
  end

  @spec delete_all([number()]) :: :ok | {:error, :not_found}
  def delete_all(maps) do
    Repo.transaction(fn ->
      {updated, nil} =
        Meta
        |> where([m], m.id in ^maps and not m.is_deleted)
        |> update(set: [is_deleted: true, updated_at: ^DateTime.utc_now()])
        |> Repo.update_all([])

      if updated != length(maps) do
        Repo.rollback(:not_found)
      end
    end)
    |> case do
      {:ok, _} -> :ok
      {:error, error} -> {:error, error}
    end
  end

  @spec update_meta(Meta.t(), map()) :: {:ok, Meta.t()} | {:error, Ecto.Changeset.t()}
  def update_meta(meta, attrs) do
    Meta.changeset(meta, attrs)
    |> Repo.update()
  end

  @spec create(map(), Keyword.t()) :: {:ok, Meta.t()} | {:error, Ecto.Changeset.t()}
  def create(attrs, opts \\ []) do
    with {:ok, meta} <-
           Meta.changeset(%Meta{}, attrs)
           |> Repo.insert() do
      if Keyword.get(opts, :preload_owner) do
        {:ok, Repo.preload(meta, :owner)}
      else
        {:ok, meta}
      end
    end
  end

  @spec rename(Meta.t(), String.t()) :: {:ok, Meta.t()} | {:error, Ecto.Changeset.t()}
  def rename(map, name) do
    Meta.changeset(map, %{name: name})
    |> Repo.update()
  end

  @spec set_general_access_level(Meta.t(), general_access_level()) ::
          {:ok, Meta.t()} | {:error, Ecto.Changeset.t()}
  def set_general_access_level(map, level) do
    Meta.changeset(map, %{general_access_level: level})
    |> Repo.update()
  end

  @spec set_general_access_role(Meta.t(), role()) ::
          {:ok, Meta.t()} | {:error, Ecto.Changeset.t()}
  def set_general_access_role(map, role) do
    Meta.changeset(map, %{general_access_role: role})
    |> Repo.update()
  end

  @doc """
  Preloads :user
  """
  @spec user_access(Meta.t()) :: [Access.t()]
  def user_access(map) do
    from(a in Access, where: a.map_id == ^map.id, preload: :user)
    |> Repo.all()
  end

  @spec pending_invites(Meta.t()) :: [PendingInvite.t()]
  def pending_invites(map) do
    from(p in PendingInvite, where: p.map_id == ^map.id)
    |> Repo.all()
  end

  @spec list_owned(User.t()) :: [Meta.t()]
  def list_owned(%User{id: user_id}) do
    Meta
    |> where(owner_id: ^user_id, is_deleted: false)
    |> order_by(asc: :name)
    |> preload(:owner)
    |> Repo.all()
  end

  @doc """
  Preloads :owner
  """
  @spec list_shared_with(User.t()) :: [Meta.t()]
  def list_shared_with(%User{id: user_id}) do
    Meta
    |> join(:inner, [m], a in Access, on: a.map_id == m.id)
    |> where([m, a], a.user_id == ^user_id)
    |> where([m, a], not m.is_deleted)
    |> order_by([m, a], asc: m.name)
    |> select([m, a], m)
    |> preload(:owner)
    |> Repo.all()
  end

  @spec invite(map()) :: :ok | {:error, Ecto.Changeset.t()}
  def invite(attrs) do
    # TODO: Also use oban to enqueue an email send
    change = PendingInvite.changeset(%PendingInvite{}, attrs)
    email = Changeset.fetch_field!(change, :email)
    existing_user = Accounts.get_user_by_email(email)

    if is_nil(existing_user) do
      Repo.insert(change)
    else
      map_id = Changeset.fetch_field!(change, :map_id)
      role = Changeset.fetch_field!(change, :role)
      share(map_id, existing_user.id, role)
    end
    |> case do
      {:ok, _} -> :ok
      {:error, error} -> {:error, error}
    end
  end

  @spec share!(Meta.t(), User.t() | number(), role()) :: nil
  def share!(map, user, role)
  def share!(map, %User{id: user}, role), do: share!(map, user, role)

  def share!(%Meta{id: map_id}, user_id, role) do
    {:ok, _} = share(map_id, user_id, role)
    nil
  end

  defp share(map_id, user_id, role) do
    Access.changeset(%Access{}, %{map_id: map_id, user_id: user_id, role: role})
    |> Repo.insert(conflict_target: [:map_id, :user_id], on_conflict: {:replace, [:role]})
  end

  @spec unshare(Meta.t(), User.t() | number()) :: nil
  def unshare(map, user)
  def unshare(map, %User{id: user}), do: unshare(map, user)

  def unshare(map, user_id) do
    from(a in Access, where: a.map_id == ^map.id and a.user_id == ^user_id)
    |> Repo.delete_all()

    nil
  end

  @type authz_action :: :share | :edit | :view | :delete

  @spec check_authorized!(
          user :: number() | User.t() | nil,
          Meta.t(),
          action :: authz_action()
        ) ::
          nil
  def check_authorized!(user, map, action) do
    case check_authorized(user, map, action) do
      :ok -> nil
      {:error, :unauthorized} -> raise UnauthorizedError, message: ""
      {:error, :forbidden} -> raise ForbiddenError, message: ""
    end
  end

  @spec check_authorized(user :: number() | User.t() | nil, Meta.t(), action :: authz_action()) ::
          :ok | {:error, :unauthorized | :forbidden}
  def check_authorized(user, map, action)

  def check_authorized(%User{id: user}, map, action), do: check_authorized(user, map, action)

  def check_authorized(user_id, map, :share) do
    cond do
      map.is_deleted ->
        {:error, :forbidden}

      is_nil(user_id) ->
        {:error, :unauthorized}

      user_id == map.owner_id ->
        :ok

      find_explicit_role(map.id, user_id) == :editor ->
        :ok

      true ->
        {:error, :forbidden}
    end
  end

  def check_authorized(user_id, map, :delete) do
    cond do
      map.is_deleted ->
        {:error, :forbidden}

      user_id == map.owner_id ->
        :ok

      true ->
        {:error, :forbidden}
    end
  end

  def check_authorized(user_id, map, :view) do
    cond do
      map.is_deleted ->
        {:error, :forbidden}

      map.general_access_level == :public ->
        :ok

      is_nil(user_id) ->
        {:error, :unauthorized}

      user_id == map.owner_id ->
        :ok

      find_explicit_role(map.id, user_id) in [:viewer, :editor] ->
        :ok

      true ->
        {:error, :forbidden}
    end
  end

  def check_authorized(user_id, map, :edit) do
    cond do
      map.is_deleted ->
        {:error, :forbidden}

      map.general_access_level == :public and map.general_access_role == :editor ->
        :ok

      is_nil(user_id) ->
        {:error, :unauthorized}

      user_id == map.owner_id ->
        :ok

      find_explicit_role(map.id, user_id) == :editor ->
        :ok

      true ->
        {:error, :forbidden}
    end
  end

  defp find_explicit_role(map_id, user_id) do
    from(a in Access, where: a.map_id == ^map_id and a.user_id == ^user_id, select: a.role)
    |> Repo.one()
  end

  def save_snapshot(map_id, value) do
    Snapshot.changeset(%Snapshot{}, %{map_id: map_id, value: value})
    |> Repo.insert()
    |> case do
      {:ok, snapshot} ->
        Logger.info("Saved snapshot of map #{map_id}")
        {:ok, snapshot}

      {:error, error} ->
        Logger.info("Failed to save snapshot of map #{map_id}: #{inspect(error)}")
        {:error, error}
    end
  end

  def latest_snapshot(%Meta{id: map_id}) do
    from(s in Snapshot, where: s.map_id == ^map_id, order_by: [desc: s.inserted_at], limit: 1)
    |> Repo.one()
  end
end
