import PlanSidebar from './PlanSidebar';
import { PlanMap } from './PlanMap';
import { useReducer } from 'react';
import { editorReducer, initialEditorState } from '@/app/plan/state';
import cls from '@/cls';

export function PlanEditor() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);

  return (
    <div
      className={cls(
        'h-full min-h-full grid',
        'grid-rows-[3fr_1fr] grid-cols-1',
        'min-[700px]:grid-rows-1 min-[700px]:grid-cols-[minmax(0,200px)_1fr] min-[1024px]:grid-cols-[minmax(0,300px)_1fr]',
      )}
    >
      <div className="h-full min-h-full row-start-2 min-[700px]:row-start-1">
        <PlanSidebar state={state} dispatch={dispatch} />
      </div>
      <PlanMap state={state} dispatch={dispatch} />
    </div>
  );
}
