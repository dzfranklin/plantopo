defmodule PlanTopo.GeoIp do
  require Logger

  @spec lookup_lnglat(:inet.ip_address()) :: {number(), number()}
  def lookup_lnglat(ip) do
    with {:ok, %{"location" => location}} <- :locus.lookup(:city, ip) do
      {location["longitude"], location["latitude"]}
    else
      :not_found ->
        Logger.info("geoip data not found for: #{inspect(ip)}")
        {0, 0}

      {:error, error} ->
        Logger.info("Error performing geoip lookup on #{inspect(ip)}: #{inspect(error)}")
        {0, 0}
    end
  end
end
