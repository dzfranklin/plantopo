import MapBase from "./MapBase";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "./hooks";
import {
  remoteSetAwareness,
  remoteSetFeatures,
  remoteSetView,
  selectFeaturesJSON,
  selectMyAwareness,
  selectShouldCreditOS,
  selectViewJSON,
} from "./mapSlice";
import LoadingIndicator from "./LoadingIndicator";
import classNames from "../classNames";
import Flash from "./Flash";
import Controls from "./Controls";
import { WebsocketProvider } from "y-websocket";
import { SyncYAwareness, SyncYJson } from "@sanalabs/y-redux";
import { Doc as YDoc } from "yjs";
import { Awareness as YAwareness } from "y-protocols/awareness";

type YMap = ReturnType<YDoc["getMap"]>;

export default function MapApp() {
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);

  const [yData, setYData] = useState(null);
  useEffect(() => {
    const doc = new YDoc();
    window._dbg.mapDoc = doc;
    const provider = new WebsocketProvider("ws://localhost:4005/map", "1", doc);
    const view = doc.getMap("view");
    const features = doc.getMap("features");
    const awareness = provider.awareness;
    setYData({ view, features, awareness });

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
            yJson={yData.view}
            selectData={selectViewJSON}
            setData={remoteSetView}
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
