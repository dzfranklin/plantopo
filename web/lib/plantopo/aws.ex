defmodule PlanTopo.AWS do
  @moduledoc """
  ```iex
  iex> PlanTopo.AWS.client() |> AWS.S3.list_objects("plantopo-test")
  ```
  """

  @spec client :: AWS.Client.t()
  def client do
    creds = credentials()

    AWS.Client.create(
      creds.access_key_id,
      creds.secret_access_key,
      creds.token,
      creds.region
    )
  end

  defp credentials do
    :aws_credentials.get_credentials()
  end
end
