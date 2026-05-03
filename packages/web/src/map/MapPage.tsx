import { AppMap } from "@/components/map";
import { MapSearch } from "@/components/map/MapSearch";

export default function MapPage() {
  return (
    <div className="h-full">
      <AppMap hash={true}>
        <MapSearch />
      </AppMap>
    </div>
  );
}
