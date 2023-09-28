import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { Titlebar } from './TitleBar/Titlebar';
import { useKeyboardShortcut } from '../../commands/commands';
import { useEngine } from './engine/useEngine';

export function MapEditor() {
  const engine = useEngine();

  useKeyboardShortcut('Delete', () => engine.deleteSelected());

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
