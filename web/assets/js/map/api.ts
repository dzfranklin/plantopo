import {
  View,
  ViewAt,
  ViewDataSource,
  ViewLayer,
  ViewLayerSource,
} from "./mapSlice";

export function reportViewAt(mapId: number, value: ViewAt) {
  send(`map/${mapId}/view_at`, "POST", { data: value });
}

export async function saveView(view: View): Promise<View> {
  let resp = await send("map/view/save", "POST", {
    data: view,
  });
  return resp.data as View;
}

export async function listViewSources(
  knownLayerSources: number[],
  knownDataSources: string[]
): Promise<{
  layerSources: { [id: number]: ViewLayerSource };
  dataSources: { [id: string]: ViewDataSource };
}> {
  const params = new URLSearchParams();
  params.set("knownLayerSources", JSON.stringify(knownLayerSources));
  params.set("knownDataSources", JSON.stringify(knownDataSources));
  let resp = await send("map/view_sources?" + params.toString(), "GET");

  return {
    layerSources: resp.data.layerSources,
    dataSources: resp.data.dataSources,
  };
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
