import { useState } from "react";

import { AppMap } from "@/components/map";
import { MapManager } from "@/components/map/MapManager";

MapManager.trace = true;

function onManager(manager: MapManager) {
  console.log("MapManager ready", manager);
}

export default function DevMapPage() {
  const [hash, setHash] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <label>
          <input
            type="checkbox"
            checked={hash}
            onChange={e => {
              setHash(e.target.checked);
              if (!e.target.checked) {
                location.hash = "";
              }
            }}
          />{" "}
          hash
        </label>
      </div>
      <AppMap
        key={`hash:${hash}`}
        hash={hash}
        onManager={onManager}
        debug={true}
      />
    </div>
  );
}
