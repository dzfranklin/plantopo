import MapBase from './base/MapBase';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from './hooks';
import {
  cancelCreating,
  deleteFeature,
  selectActiveFeature,
  selectDataLoaded,
  selectInCreate,
  selectShouldCreditOS,
} from './mapSlice';
import LoadingIndicator from './base/LoadingIndicator';
import classNames from '../classNames';
import Flash from './Flash';
import Controls from './Controls';
import MapSync from './MapSync';
import Sidebar from './Sidebar';

export default function MapApp() {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const dataLoaded = useAppSelector(selectDataLoaded);
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);

  useEffect(() => {
    if (!dataLoaded) return;
    const handler = (event: KeyboardEvent) => {
      const { key } = event;
      const state = store.getState();
      const active = selectActiveFeature(state);
      const inCreate = selectInCreate(state);

      if (key === 'Delete' && active) {
        dispatch(deleteFeature(active));
      } else if (key === 'Escape' && inCreate) {
        dispatch(cancelCreating());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dataLoaded, dispatch, store]);

  return (
    <div className="map-app">
      <MapSync />

      {dataLoaded ? (
        <>
          <MapBase isLoading={setBaseIsLoading} />
          <CreditImages creditOS={creditOS} />
          <LoadingIndicator isLoading={baseIsLoading} />

          <Sidebar />

          <Controls />
        </>
      ) : (
        'TODO LOADING INDICATOR'
      )}

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
        className={classNames('h-full', props.creditOS || 'hidden')}
      />
    </div>
  );
}
