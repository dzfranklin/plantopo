import BaseMap from './base/BaseMap';
import { useState } from 'react';
import { useAppSelector } from './hooks';
import LoadingIndicator from './base/LoadingIndicator';
import Flash from './flash/Flash';
import Controls from './controls/Controls';
import MapSync from './sync/Sync';
import Sidebar from './sidebar/Sidebar';
import { useGlobalKeyboardShortcuts } from './keyboardShortcuts';
import { selectShouldCreditOS } from './layers/slice';
import { selectDidInitialLoad } from './sync/slice';
import { AnimatePresence, motion } from 'framer-motion';

export default function MapApp() {
  const loaded = useAppSelector(selectDidInitialLoad);
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);

  useGlobalKeyboardShortcuts();

  return (
    <div className="map-app">
      <MapSync />

      {loaded ? (
        <>
          <BaseMap isLoading={setBaseIsLoading} />
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
    <motion.div
      layout
      className="credit-images pointer-events-none flex flex-row gap-2 h-[32px] pb-[8px] pl-[8px]"
    >
      <img src="/images/mapbox_logo.svg" className="h-full" />

      <AnimatePresence initial={false}>
        {props.creditOS && (
          <motion.img
            layoutId="credit-os"
            src="/images/os_logo.svg"
            className="h-full"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
