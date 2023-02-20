import { ViewAt } from "./mapSlice";

export function reportViewAt(mapId: number, value: ViewAt) {
  send(`map/${mapId}/view_at`, "POST", { data: value });
}

async function send(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  data?: any
): Promise<{ [_: string | number]: any } | undefined> {
  console.debug("Sending", { path, method, data });
  const resp = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data && JSON.stringify(data),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Send ${path} failed: ${body}`);
  }

  if (resp.status == 204) {
    return;
  } else {
    return resp.json();
  }
}
