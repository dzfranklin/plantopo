import cls from '@/generic/cls';
import { useEngine, useSceneSelector } from '../../engine/useEngine';
import { LineToolIcon } from './LineToolIcon';
import { PointToolIcon } from './PointToolIcon';
import { useCommand } from '@/features/commands/commands';

const tools = [
  { id: 'line', icon: LineToolIcon },
  { id: 'point', icon: PointToolIcon },
] as const;

export function MapToolbar() {
  const engine = useEngine();
  const activeTool = useSceneSelector((s) => s.activeTool);
  const sidebarWidth = useSceneSelector((s) => s.sidebarWidth);
  const isDisabled = !engine || !engine.mayEdit;
  useCommand({
    key: 'l',
    label: 'Select line tool',
    action: () => engine?.setActiveTool('line'),
  });
  useCommand({
    key: 'p',
    label: 'Select point tool',
    action: () => engine?.setActiveTool('point'),
  });
  return (
    <div
      className="absolute top-0 z-10 pt-2 pl-1"
      style={{ left: `${sidebarWidth}px` }}
    >
      <div className="flex flex-col border-[#d8d4d2] rounded-md shadow-sm bg-white border-[2px]">
        {tools.map((tool) => (
          <button
            key={tool.id}
            disabled={isDisabled}
            onClick={() => engine?.setActiveTool(tool.id)}
            className={cls(
              'p-1.5 rounded-md',
              isDisabled && 'opacity-50',
              !isDisabled && activeTool === tool.id
                ? 'text-blue-100 bg-blue-100 border-blue-600 border-2 -m-[2px]'
                : 'border-[#d8d4d2] text-white',
            )}
          >
            <tool.icon />
          </button>
        ))}
      </div>
    </div>
  );
}
