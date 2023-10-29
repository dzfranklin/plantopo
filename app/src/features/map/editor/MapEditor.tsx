import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { Titlebar } from './TitleBar/Titlebar';
import { useCommand } from '../../commands/commands';
import { useEngine } from './engine/useEngine';

export function MapEditor() {
  const engine = useEngine();

  useCommand({
    key: 'Delete',
    label: 'Delete selected feature',
    action: () => engine?.deleteSelected(),
  });
  useCommand({
    key: 'Backspace',
    label: 'Delete selected feature',
    action: () => engine?.deleteSelected(),
  });
  useCommand({
    key: 'Enter',
    label: 'Finish action',
    action: () => engine?.finishAction(),
  });

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
