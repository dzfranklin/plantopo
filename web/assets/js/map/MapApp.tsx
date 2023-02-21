import MapBase from "./MapBase";
import { useEffect, useState } from "react";
import { useAppSelector } from "./hooks";
import {
  remoteSetAwareness,
  remoteSetFeatures,
  remoteSetLayers,
  selectFeaturesJSON,
  selectMyAwareness,
  selectShouldCreditOS,
  selectLayersJSON,
} from "./mapSlice";
import LoadingIndicator from "./LoadingIndicator";
import classNames from "../classNames";
import Flash from "./Flash";
import Controls from "./Controls";
import { WebsocketProvider } from "y-websocket";
import { SyncYAwareness, SyncYJson } from "@sanalabs/y-redux";
import { Doc as YDoc } from "yjs";

export default function MapApp() {
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);

  const [yData, setYData] = useState(null);
  useEffect(() => {
    const doc = new YDoc({ gc: false });
    window._dbg.mapDoc = doc;

    const layers = doc.getArray("layers");
    const features = doc.getMap("features");

    let server = new URL(location.href);
    server.protocol = location.protocol === "https:" ? "wss" : "ws";
    server.port = "4005";
    server.pathname = "map/c2f85ed1-38e3-444c-b6bc-ae33a831ca5a";
    const provider = new WebsocketProvider(server.toString(), "socket", doc);

    const awareness = provider.awareness;
    setYData({ layers, features, awareness });

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, []);

  return (
    <div className="map-app">
      {yData && (
        <>
          <SyncYJson
            yJson={yData.layers}
            selectData={selectLayersJSON}
            setData={remoteSetLayers}
          />
          <SyncYJson
            yJson={yData.features}
            selectData={selectFeaturesJSON}
            setData={remoteSetFeatures}
          />
          <SyncYAwareness
            awareness={yData.awareness}
            selectLocalAwarenessState={selectMyAwareness}
            setAwarenessStates={remoteSetAwareness}
          />
        </>
      )}

      <MapBase isLoading={setBaseIsLoading} />
      <CreditImages creditOS={creditOS} />
      <LoadingIndicator isLoading={baseIsLoading} />

      <Controls />

      <Flash />
    </div>
  );
}

function CreditImages(props: { creditOS: boolean }) {
  return (
    <div className="credit-images pointer-events-none flex flex-row gap-2 h-[24px] ml-[8px] mb-[8px]">
      <img src="/images/mapbox_logo.svg" className="h-full" />
      <img
        src="/images/os_logo.svg"
        className={classNames("h-full", props.creditOS || "hidden")}
      />
    </div>
  );
}
