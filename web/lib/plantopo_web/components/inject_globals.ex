defmodule PlanTopoWeb.InjectGlobals do
  alias PlanTopo.Accounts.{User, UserSettings}
  require Logger

  def inject(user) do
    settings =
      case user do
        nil ->
          %UserSettings{}

        %User{settings: nil} ->
          %UserSettings{}

        %User{settings: %UserSettings{} = settings} ->
          settings
      end

    ~s[
        window.currentUser = #{user_to_js(user)};
        window.appSettings = #{settings_to_js(settings)};
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          window.appSettings.disableAnimation = true;
        }
      ]
  end

  defp user_to_js(nil) do
    ~s[null]
  end

  defp user_to_js(user) do
    %{
      id: user.id,
      username: user.username
    }
    |> Jason.encode!(escape: :javascript_safe)
  end

  defp settings_to_js(settings) do
    %{
      disableAnimation: settings.disable_animation,
      advanced: settings.advanced
    }
    |> Jason.encode!(escape: :javascript_safe)
  end
end
