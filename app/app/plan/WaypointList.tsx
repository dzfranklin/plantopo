import { ControlPoint, EditorDispatch, EditorState } from './state';
import { metersBetween } from '@/geo';
import DistanceText from '@/features/units/DistanceText';
import ElevationText from '@/features/units/ElevationText';

export function WaypointList({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: EditorDispatch;
}) {
  const waypoints: JSX.Element[] = [];
  let runningDistance = 0;
  let distanceGain = 0;
  let runningElevation = 0;
  let elevationGain = 0;
  for (let i = 0; i < state.points.length; i++) {
    const p = state.points[i]!;

    if (i > 0) {
      const prev = state.points[i - 1]!;

      const distanceDelta = metersBetween(prev.lngLat, p.lngLat);
      runningDistance += distanceDelta;
      distanceGain += distanceDelta;

      // TODO:
      runningElevation += 0;
      elevationGain += 0;
    }

    waypoints.push(
      <WaypointListEntry
        key={p.id}
        point={p}
        isStart={i === 0}
        isEnd={i === state.points.length - 1}
        runningDistance={runningDistance}
        distanceGain={distanceGain}
        runningElevation={runningElevation}
        elevationGain={elevationGain}
        dispatch={dispatch}
      />,
    );

    if (p.waypoint) {
      distanceGain = 0;
      elevationGain = 0;
    }
  }

  return (
    <div>
      <ul className="pl-3.5">{waypoints}</ul>
    </div>
  );
}

export function WaypointListEntry({
  point,
  isStart,
  isEnd,
  runningDistance,
  distanceGain,
  runningElevation,
  elevationGain,
}: {
  point: ControlPoint;
  isStart: boolean;
  isEnd: boolean;
  runningDistance: number;
  distanceGain: number;
  runningElevation: number;
  elevationGain: number;
  dispatch: EditorDispatch;
}) {
  if (!point.waypoint && !isStart && !isEnd) {
    return null;
  }

  return (
    <li className="list-disc">
      <div className="text-sm font-medium">
        {waypointName({ point, isStart, isEnd })}
      </div>
      {!isStart && (point.waypoint || isEnd) && (
        <div className="text-xs mt-0.5 mb-1">
          <span className="whitespace-nowrap">
            +<DistanceText meters={distanceGain} /> (
            <DistanceText meters={runningDistance} />)
          </span>
          {' / '}
          <span className="whitespace-nowrap">
            <ElevationText meters={elevationGain} /> (
            <ElevationText meters={runningElevation} />)
          </span>
        </div>
      )}
    </li>
  );
}

function waypointName({
  point,
  isStart,
  isEnd,
}: {
  point: ControlPoint;
  isStart: boolean;
  isEnd: boolean;
}) {
  if (point.waypoint) {
    return point.waypoint.name;
  } else if (isStart) {
    return 'Start';
  } else if (isEnd) {
    return 'End';
  } else {
    return null;
  }
}
