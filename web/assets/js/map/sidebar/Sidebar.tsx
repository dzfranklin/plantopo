import { useEffect } from 'react';
import AddDropdown from './AddDropdown';
import FeatureTree from './FeatureTree';

export default function Sidebar() {
  useEffect(() => {
    document.body.classList.add('sidebar-is-open');
  }, []);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_min-content] grid-rows-1 sidebar">
      <div className="flex flex-col bg-white">
        <div>TODO title</div>
        <div>TODO search</div>
        <div className="flex flex-row justify-end mx-[14px] mb-[8px]">
          <AddDropdown />
        </div>
        <FeatureTree />
      </div>

      <div className="col-2">Tab</div>
    </div>
  );
}
