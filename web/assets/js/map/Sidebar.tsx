import FeatureTree from './sidebar/FeatureTree';

export default function Sidebar() {
  return (
    <div className="grid grid-cols-[1fr_min-content] grid-rows-1 sidebar">
      <div className="flex flex-col bg-white">
        <div>TODO title</div>
        <div>TODO search</div>
        <FeatureTree />
      </div>

      <div className="col-2">Tab</div>
    </div>
  );
}
