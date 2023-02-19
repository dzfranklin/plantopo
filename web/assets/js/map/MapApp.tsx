import MapBase from "./MapBase";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./hooks";
import { selectShouldCreditOS } from "./mapSlice";
import LoadingIndicator from "./LoadingIndicator";
import classNames from "../classNames";
import Flash from "./Flash";
import Controls from "./Controls";

export default function MapApp() {
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);

  return (
    <div className="map-app">
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
