import { AppMap, MapManager } from "@/components/map";

MapManager.trace = true;

function onManager(manager: MapManager) {
  console.log("MapManager ready", manager);
}

export default function DevMapPage() {
  return (
    <div className="h-full">
      <AppMap hash={true} onManager={onManager} />
    </div>
  );
}
