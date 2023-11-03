import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { Titlebar } from './TitleBar/Titlebar';

export function MapEditor() {
  return (
    <div className="grid grid-cols-1 grid-rows-[min-content_minmax(0,1fr)] w-full h-full overflow-hidden">
      <Titlebar />
      <div className="relative">
        <MapContainer />
        <Sidebar />
      </div>
    </div>
  );
}
