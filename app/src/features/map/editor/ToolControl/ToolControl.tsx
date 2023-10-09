import {
  useEngine,
  useSceneSelector,
} from '@/features/map/editor/engine/useEngine';
import cls from '@/generic/cls';

const tools = [
  { name: 'Create point', action: 'createPoint' },
  { name: 'Create line', action: 'createLine' },
] as const;

export function ToolControl() {
  const engine = useEngine();
  const sidebarWidth = useSceneSelector((s) => s.sidebarWidth);
  const activeTool = useSceneSelector((s) => s.activeTool);

  return (
    <div className="absolute top-1" style={{ left: sidebarWidth }}>
      <div className="flex flex-col">
        {tools.map(({ name, action }) => (
          <button
            key={action}
            title={name}
            onClick={() => engine.setActiveTool(action)}
            className={cls(
              'p-1 text-white',
              action === activeTool && 'bg-red-500',
            )}
          >
            TODO {name}
          </button>
        ))}
      </div>
    </div>
  );
}
