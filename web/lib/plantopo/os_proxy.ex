defmodule PlanTopo.OSProxy do
  require Logger
  @compile :export_all

  # TODO: Rate limit fetch_web!. Handle errors and feed into rate limit

  def clear_cache, do: Cachex.clear(__MODULE__.Cachex)

  def fetch(path, query, rewrite_to) do
    case Cachex.get!(__MODULE__.Cachex, {path, query}) do
      nil ->
        {result, reply} = fetch_web(path, query, rewrite_to)
        if result == :ok, do: Cachex.set!(__MODULE__.Cachex, {path, query}, result)
        reply

      reply ->
        reply
    end
  end

  defp fetch_web(path, query, rewrite_to) do
    key = Application.fetch_env!(:plantopo, __MODULE__) |> Keyword.fetch!(:api_key)

    query =
      if Map.get(query, "key") == "" do
        Map.put(query, "key", key)
      else
        query
      end
      |> URI.encode_query()

    url =
      %URI{
        scheme: "https",
        host: "api.os.uk",
        path: path,
        query: query
      }
      |> URI.to_string()

    resp = Finch.build(:get, url) |> Finch.request(PlanTopo.Finch)

    with {:ok, %{status: 200, body: body, headers: headers}} <- resp do
      content_type = get_header(headers, "content-type")
      content_encoding = get_header(headers, "content-encoding")

      _resp_meta = %{
        category: get_header(headers, "omse-category"),
        transaction_count: get_header(headers, "omse-transaction-count") |> String.to_integer(),
        premium_count: get_header(headers, "omse-premium-count") |> String.to_integer()
      }

      body =
        if String.starts_with?(content_type, "application/json") do
          rewrite_json_body(body, rewrite_to, key)
        else
          body
        end

      {:ok,
       %{
         status: 200,
         content_type: content_type,
         content_encoding: content_encoding,
         body: body
       }}
    else
      {:ok, %{status: status, body: body}} ->
        if status != 404, do: Logger.warn("Got http status #{status} from OS: #{inspect(body)}")

        {:error,
         %{
           status: status,
           content_type: "text/plain",
           body: "Proxy got http status #{status} from Ordnance Survey"
         }}

      {:error, error} ->
        Logger.warn("Error requesting #{inspect(redact_key(url, key))}: #{inspect(error)}")

        {:error,
         %{
           status: 500,
           content_type: "text/plain",
           body: "Proxy couldn't send request"
         }}
    end
  end

  defp get_header(headers, key) do
    Enum.find_value(headers, fn
      {^key, value} -> value
      _ -> false
    end)
  end

  defp rewrite_json_body(body, rewrite_to, key) do
    body =
      body
      |> Jason.decode!()
      |> rewrite_json_term(rewrite_to)
      |> Jason.encode!()

    if String.contains?(body, key) do
      throw("Rewritten json body still contains key")
    else
      body
    end
  end

  defp rewrite_json_term(term, rewrite_to) when is_map(term) do
    term
    |> Enum.map(fn {k, v} -> {k, rewrite_json_term(v, rewrite_to)} end)
    |> Enum.into(%{})
  end

  defp rewrite_json_term(term, rewrite_to) when is_list(term) do
    Enum.map(term, &rewrite_json_term(&1, rewrite_to))
  end

  defp rewrite_json_term(term, rewrite_to) when is_binary(term) do
    if String.starts_with?(term, "https://api.os.uk/") do
      url = URI.parse(term)
      query = url.query |> URI.decode_query() |> Map.replace("key", "") |> URI.encode_query()
      %URI{rewrite_to | path: url.path, query: query} |> URI.to_string()
    else
      term
    end
  end

  defp rewrite_json_term(term, _rewrite_to), do: term

  defp redact_key(s, key), do: String.replace(s, key, "<key redacted>")
end
