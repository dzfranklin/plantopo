import { ChevronLeftIcon } from '@heroicons/react/24/solid';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import AddDropdown from './AddDropdown';
import FeatureTree from './FeatureTree';
import { selectSidebarOpen, toggleOpen } from './slice';

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
