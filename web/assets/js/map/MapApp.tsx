import MapBase from "./MapBase";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./hooks";
import {
  editView,
  selectShouldCreditOS,
  selectViewEditorIsActive,
} from "./mapSlice";
import LoadingIndicator from "./LoadingIndicator";
import classNames from "../classNames";
import ViewEditor from "./ViewEditor";
import Flash from "./Flash";

export default function MapApp() {
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);
  const viewEditorIsActive = useAppSelector(selectViewEditorIsActive);

  // TODO: For testing
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(editView(null));
  }, [dispatch]);

  return (
    <div className="map-app">
      <Flash />
      <LoadingIndicator isLoading={baseIsLoading} />

      <MapBase isLoading={setBaseIsLoading} />
      <CreditImages creditOS={creditOS} />

      {viewEditorIsActive && <ViewEditor />}
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
