defmodule PlanTopoWeb.UserSettingsLive do
  use PlanTopoWeb, :live_view
  alias PlanTopo.Accounts
  require Logger

  def render(assigns) do
    ~H"""
    <.header>Settings</.header>

    <.header>Change email</.header>

    <.simple_form
      :let={f}
      id="email_form"
      for={@email_changeset}
      phx-submit="update_email"
      phx-change="validate_email"
    >
      <.error :if={@email_changeset.action == :insert}>
        Please check the errors below.
      </.error>

      <.input field={{f, :email}} type="email" label="Email" required />

      <.input
        field={{f, :current_password}}
        name="current_password"
        id="current_password_for_email"
        type="password"
        label="Current password"
        value={@email_form_current_password}
        autocomplete="current-password"
        required
      />
      <:actions>
        <.button phx-disable-with="Changing...">Change Email</.button>
      </:actions>
    </.simple_form>

    <.header>Change password</.header>

    <.simple_form
      :let={f}
      id="password_form"
      for={@password_changeset}
      action={~p"/account/login?_action=password_updated"}
      method="post"
      phx-change="validate_password"
      phx-submit="update_password"
      phx-trigger-action={@trigger_submit}
    >
      <.error :if={@password_changeset.action == :insert}>
        Please check the errors below.
      </.error>

      <.input field={{f, :email}} type="hidden" value={@current_email} />

      <.input
        field={{f, :password}}
        type="password"
        label="New password"
        autocomplete="new-password"
        required
      />
      <.input
        field={{f, :password_confirmation}}
        type="password"
        autocomplete="new-password"
        label="Confirm new password"
      />
      <.input
        field={{f, :current_password}}
        name="current_password"
        type="password"
        label="Current password"
        id="current_password_for_password"
        value={@current_password}
        autocomplete="current-password"
        required
      />
      <:actions>
        <.button phx-disable-with="Changing...">Change Password</.button>
      </:actions>
    </.simple_form>

    <.header>Change name</.header>

    <.simple_form
      :let={f}
      id="name_form"
      for={@name_changeset}
      phx-submit="update_name"
      phx-change="validate_name"
    >
      <.error :if={@name_changeset.action == :insert}>
        Please check the errors below.
      </.error>

      <.input field={{f, :name}} type="text" label="Name" required />

      <:actions>
        <.button phx-disable-with="Changing...">Change name</.button>
      </:actions>
    </.simple_form>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    socket =
      case Accounts.update_user_email(socket.assigns.current_user, token) do
        :ok ->
          put_flash(socket, :info, "Email changed successfully.")

        :error ->
          put_flash(socket, :error, "Email change link is invalid or it has expired.")
      end

    {:ok, push_navigate(socket, to: ~p"/account/settings")}
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_user

    socket =
      socket
      |> assign(:current_password, nil)
      |> assign(:email_form_current_password, nil)
      |> assign(:current_email, user.email)
      |> assign(:email_changeset, Accounts.change_user_email(user))
      |> assign(:password_changeset, Accounts.change_user_password(user))
      |> assign(:name_changeset, Accounts.change_name(user))
      |> assign(:trigger_submit, false)

    {:ok, socket}
  end

  def handle_event("validate_email", params, socket) do
    %{"current_password" => password, "user" => user_params} = params
    email_changeset = Accounts.change_user_email(socket.assigns.current_user, user_params)

    socket =
      assign(socket,
        email_changeset: Map.put(email_changeset, :action, :validate),
        email_form_current_password: password
      )

    {:noreply, socket}
  end

  def handle_event("update_email", params, socket) do
    %{"current_password" => password, "user" => user_params} = params
    user = socket.assigns.current_user

    case Accounts.apply_user_email(user, password, user_params) do
      {:ok, applied_user} ->
        Accounts.deliver_user_update_email_instructions(
          applied_user,
          user.email,
          &url(~p"/account/settings/confirm_email/#{&1}")
        )
        |> case do
          {:ok, _} ->
            nil

          {:error, error} ->
            Logger.info("Failed to deliver user update email instructions: #{inspect(error)}")
        end

        info = "A link to confirm your email change has been sent to the new address."
        {:noreply, put_flash(socket, :info, info)}

      {:error, changeset} ->
        {:noreply, assign(socket, :email_changeset, Map.put(changeset, :action, :insert))}
    end
  end

  def handle_event("validate_name", params, socket) do
    %{"user" => user_params} = params
    name_changeset = Accounts.change_name(socket.assigns.current_user, user_params)

    socket =
      assign(socket,
        name_changeset: Map.put(name_changeset, :action, :validate)
      )

    {:noreply, socket}
  end

  def handle_event("update_name", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.current_user

    case Accounts.update_name(user, user_params) do
      {:ok, user} ->
        socket =
          socket
          |> assign(:current_user, user)
          |> put_flash(:info, "Settings saved")

        {:noreply, socket}

      {:error, change} ->
        {:noreply, assign(socket, :name_changeset, change)}
    end
  end

  def handle_event("validate_password", params, socket) do
    %{"current_password" => password, "user" => user_params} = params
    password_changeset = Accounts.change_user_password(socket.assigns.current_user, user_params)

    {:noreply,
     socket
     |> assign(:password_changeset, Map.put(password_changeset, :action, :validate))
     |> assign(:current_password, password)}
  end

  def handle_event("update_password", params, socket) do
    %{"current_password" => password, "user" => user_params} = params
    user = socket.assigns.current_user

    case Accounts.update_user_password(user, password, user_params) do
      {:ok, user} ->
        socket =
          socket
          |> assign(:trigger_submit, true)
          |> assign(:password_changeset, Accounts.change_user_password(user, user_params))

        {:noreply, socket}

      {:error, changeset} ->
        {:noreply, assign(socket, :password_changeset, changeset)}
    end
  end
end
