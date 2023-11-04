import cls from '@/generic/cls';
import { useEngine, useSceneSelector } from '../../engine/useEngine';
import { LineToolIcon } from './LineToolIcon';
import { PointToolIcon } from './PointToolIcon';
import { SelectToolIcon } from './SelectToolIcon';

const tools = [
  { id: 'select', icon: SelectToolIcon },
  { id: 'line', icon: LineToolIcon },
  { id: 'point', icon: PointToolIcon },
] as const;

export function MapToolbar() {
  const engine = useEngine();
  const activeTool = useSceneSelector((s) => s.activeTool);
  const sidebarWidth = useSceneSelector((s) => s.sidebarWidth);
  const isDisabled = !engine || !engine.mayEdit;

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
            onClick={() => {
              if (!engine) return;
              switch (tool.id) {
                case 'select':
                  engine.execute('use-select-tool');
                  break;
                case 'line':
                  engine.execute('use-line-tool');
                  break;
                case 'point':
                  engine.execute('use-point-tool');
                  break;
              }
            }}
            className={cls(
              'p-1.5 rounded-md w-[40px] h-[40px] -m-[2px] border-x-2 grid place-items-center',
              isDisabled && 'opacity-50',
              !isDisabled && activeTool === tool.id
                ? 'text-blue-100 bg-blue-100 border-blue-600 border-y-2'
                : 'border-transparent text-white',
            )}
          >
            <tool.icon />
          </button>
        ))}
      </div>
    </div>
  );
}
