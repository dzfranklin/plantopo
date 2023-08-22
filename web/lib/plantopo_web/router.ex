defmodule PlanTopoWeb.Router do
  use PlanTopoWeb, :router

  import PlanTopoWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, {PlanTopoWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_current_user
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug :fetch_session
    plug :fetch_current_user
    plug CORSPlug
  end

  ## Auth optional

  scope "/", PlanTopoWeb do
    pipe_through [:browser]

    delete "/account/logout", UserSessionController, :delete

    live_session :current_user,
      on_mount: [{PlanTopoWeb.UserAuth, :mount_current_user}] do
      live "/account/confirm/:token", UserConfirmationLive, :edit
      live "/account/confirm", UserConfirmationInstructionsLive, :new
    end
  end

  scope "/api", PlanTopoWeb do
    pipe_through :api

    get "/tokens.json", TokensController, :index
  end

  ## Auth forbidden
  scope "/", PlanTopoWeb do
    pipe_through [:browser, :redirect_if_user_is_authenticated]

    live_session :redirect_if_user_is_authenticated,
      on_mount: [{PlanTopoWeb.UserAuth, :redirect_if_user_is_authenticated}] do
      live "/account/register", UserRegistrationLive, :new
      live "/account/login", UserLoginLive, :new
      live "/account/reset_password", UserForgotPasswordLive, :new
      live "/account/reset_password/:token", UserResetPasswordLive, :edit
    end

    post "/account/login", UserSessionController, :create
  end

  ## Auth required

  scope "/", PlanTopoWeb do
    pipe_through [:browser, :require_authenticated_user]

    live_session :require_authenticated_user,
      on_mount: [{PlanTopoWeb.UserAuth, :ensure_authenticated}] do
      live "/maps", MapsLive, :index
      live "/account/settings", UserSettingsLive, :edit
      live "/account/settings/confirm_email/:token", UserSettingsLive, :confirm_email
    end
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:plantopo, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: PlanTopoWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
