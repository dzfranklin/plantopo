import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { Titlebar } from './TitleBar/Titlebar';
import { useKeyboardShortcut } from '../../commands/commands';
import { useEngine } from './engine/useEngine';

export function MapEditor() {
  const engine = useEngine();

  useKeyboardShortcut(
    'Delete',
    'Delete selected feature',
    () => engine?.deleteSelected(),
  );
  useKeyboardShortcut(
    'Backspace',
    'Delete selected feature',
    () => engine?.deleteSelected(),
  );

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
