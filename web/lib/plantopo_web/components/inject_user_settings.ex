defmodule PlanTopoWeb.InjectUserSettings do
  alias PlanTopo.Accounts.{User, UserSettings}
  require Logger

  def inject(user) do
    settings =
      with %User{} = user <- user,
           %UserSettings{} = settings <- user.settings do
        settings
      else
        nil ->
          %UserSettings{}

        %Ecto.Association.NotLoaded{} ->
          Logger.info("InjectUserSettings: Skipping as assocation not loaded")
          nil
      end

    if not is_nil(settings) do
      settings = %{
        disableAnimation: settings.disable_animation,
        advanced: settings.advanced
      }

      ~s[window.userSettings = #{Jason.encode!(settings, escape: :javascript_safe)}]
    end
  end
end
