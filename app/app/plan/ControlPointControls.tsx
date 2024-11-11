import { ControlPoint, EditorDispatch } from '@/app/plan/state';
import { Button } from '@/components/button';
import { Input } from '@/components/input';

export function ControlPointControls({
  point,
  i,
  dispatch,
}: {
  point: ControlPoint;
  i: number;
  dispatch: EditorDispatch;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="text-xs font-semibold">
        {point.waypoint?.name
          ? `${point.waypoint.name} (Point ${i + 1})`
          : `Point ${i + 1}`}
      </div>

      <div className="my-2 px-1">
        <Input
          small
          placeholder="Name waypoint"
          value={point.waypoint?.name ?? ''}
          onChange={(ev) => {
            dispatch({
              type: 'updateWaypoint',
              payload: {
                id: point.id,
                waypoint:
                  ev.target.value.length > 0
                    ? { name: ev.target.value }
                    : undefined,
              },
            });
          }}
        />
      </div>

      <div className="mt-auto flex">
        <Button
          small
          color="red"
          className="ml-auto"
          onClick={() =>
            dispatch({ type: 'delete', payload: { id: point.id } })
          }
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
