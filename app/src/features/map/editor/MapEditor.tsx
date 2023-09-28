import { useMapMeta } from '@/features/map/api/mapMeta';
import { PageTitle } from '@/generic/PageTitle';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { Titlebar } from './TitleBar/Titlebar';

export function MapEditor() {
  return (
    <div className="grid grid-cols-1 grid-rows-[30px_minmax(0,1fr)] w-full h-full overflow-hidden">
      <Titlebar />
      <div className="relative">
        <MapContainer />
        <Sidebar />
      </div>
    </div>
  );
}
