import { ChevronLeftIcon } from '@heroicons/react/24/solid';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import AddDropdown from './AddDropdown';
import FeatureTree from './FeatureTree';
import { selectSidebarOpen, toggleOpen } from './slice';
import useSyncStatus from '../sync/useSyncStatus';
import useSyncSelector from '../sync/useSyncSelector';

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectSidebarOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('sidebar-is-open');
    } else {
      document.body.classList.remove('sidebar-is-open');
    }
    () => document.body.classList.remove('sidebar-is-open');
  }, [isOpen]);

  return (
    <motion.div
      animate={isOpen ? 'open' : 'closed'}
      className="flex flex-row grid-rows-1 pointer-events-none sidebar"
      transition={{ duration: 40 }}
    >
      <motion.div
        className="bg-white"
        initial={false}
        variants={{
          open: { width: '100%' },
          closed: { width: 0 },
        }}
      >
        {isOpen && (
          <AnimatePresence>
            <motion.div
              className="flex flex-col h-full border-r border-gray-300 pointer-events-auto"
              exit={{ opacity: 0 }}
            >
              <div>TODO title</div>
              <div>TODO search</div>
              <SyncStatus />
              <div className="flex flex-row justify-end mx-[14px] mb-[8px]">
                <AddDropdown />
              </div>
              <hr className="mx-4 mb-2 border-t border-gray-300" />
              <FeatureTree />
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      <motion.div
        layout
        className="col-2 sidebar__control pointer-events-auto bg-white border border-l-0 border-gray-300 rounded-[0_2px_2px_0]"
      >
        <motion.button
          onClick={() => dispatch(toggleOpen())}
          className="h-full py-[2px] pl-[2px] pr-[3px]"
          variants={{
            open: { rotate: 0 },
            closed: { rotate: 180 },
          }}
        >
          <ChevronLeftIcon className="h-full w-[20px] fill-gray-500" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

const SyncStatus = () => {
  const status = useSyncStatus();
  const debug = useSyncSelector((s) => s);
  return (
    <div>
      {status.type === 'connecting' &&
        (status.willRetryAt ? (
          <RetryStatusMessage retryAt={status.willRetryAt} />
        ) : (
          'Connecting...'
        ))}

      {status.type === 'connected' && 'Connected'}
      {status.type === 'disconnected' && 'Disconnected'}

      <pre>
        <code>{JSON.stringify(debug, null, 2)}</code>
      </pre>
    </div>
  );
};

const RetryStatusMessage = ({ retryAt }: { retryAt: number }) => {
  const [seconds, setSeconds] = useState(() => secondsUntil(retryAt));
  useEffect(() => {
    const interval = setInterval(() => setSeconds(secondsUntil(retryAt)), 500);
    return () => clearInterval(interval);
  }, [retryAt]);

  return (
    <span>
      Failed to connect
      <span className="ml-1 text-gray-700">
        (retrying in {seconds} {seconds === 1 ? 'second' : 'seconds'})
      </span>
    </span>
  );
};

const secondsUntil = (retryAt: number) => {
  const millis = retryAt - new Date().getTime();
  return Math.round(millis / 1_000);
};
