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
  end

  ## Auth optional
  scope "/", PlanTopoWeb do
    pipe_through [:browser]

    get "/", PageController, :home
    delete "/users/log_out", UserSessionController, :delete

    live_session :current_user,
      on_mount: [{PlanTopoWeb.UserAuth, :mount_current_user}] do
      live "/users/confirm/:token", UserConfirmationLive, :edit
      live "/users/confirm", UserConfirmationInstructionsLive, :new
    end
  end

  ## Auth forbidden
  scope "/", PlanTopoWeb do
    pipe_through [:browser, :redirect_if_user_is_authenticated]

    live_session :redirect_if_user_is_authenticated,
      on_mount: [{PlanTopoWeb.UserAuth, :redirect_if_user_is_authenticated}] do
      live "/users/register", UserRegistrationLive, :new
      live "/users/log_in", UserLoginLive, :new
      live "/users/reset_password", UserForgotPasswordLive, :new
      live "/users/reset_password/:token", UserResetPasswordLive, :edit
    end

    post "/users/log_in", UserSessionController, :create
  end

  ## Auth required

  scope "/", PlanTopoWeb do
    pipe_through [:browser, :require_authenticated_user]

    get "/map/:id", MapController, :show

    live_session :require_authenticated_user,
      on_mount: [{PlanTopoWeb.UserAuth, :ensure_authenticated}] do
      live "/users/settings", UserSettingsLive, :edit
      live "/users/settings/confirm_email/:token", UserSettingsLive, :confirm_email
    end
  end

  scope "/api/", PlanTopoWeb do
    pipe_through [:api, :api_require_authenticated_user]

    post "/map/:id/view_at", MapApiController, :set_view_at
    post "/map/view/save", MapApiController, :save_view
    get "/map/view_sources", MapApiController, :list_view_sources
  end

  # scope "/api/map", PlanTopoWeb do
  #   pipe_through [:api, :api_require_authenticated_user]

  #   get "/view/default", MapApiController, :list_default_view
  #   get "/view/user", MapApiController, :list_user_view
  #   post "/view/user", MapApiController, :create_user_view
  #   put "/view/user/:id", MapApiController, :update_user_view
  #   delete "/view/user/:id", MapApiController, :delete_user_view
  #   get "/view/default/:id/:ty/i.png", MapApiController, :get_default_view_preview
  #   get "/view/user/:id/:ty/i.png", MapApiController, :get_user_view_preview

  #   get "/source", MapApiController, :list_source
  # end

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
