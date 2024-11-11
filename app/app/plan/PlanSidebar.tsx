import { EditorDispatch, EditorState } from './state';
import { WaypointList } from './WaypointList';

export default function PlanSidebar({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: EditorDispatch;
}) {
  return (
    <div className="h-full min-h-full overflow-x-hidden overflow-y-auto p-3">
      <WaypointList state={state} dispatch={dispatch} />
    </div>
  );
}
