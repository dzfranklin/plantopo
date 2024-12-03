import { MapComponent } from '@/features/map/MapComponent';
import { useMap, useOnMap } from '@/features/map/useMap';
import { Dispatch, useCallback, useEffect, useRef } from 'react';
import {
  ActiveCandidate,
  ControlPoint,
  EditorDispatch,
  EditorState,
} from './state';
import { clamp, pythagoreanDist } from '@/math';
import { ControlPointControls } from './ControlPointControls';
import cls from '@/cls';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useHighwayGraph } from '@/features/map/snap/provider';
import { mapBBox } from '@/features/map/util';
import * as ml from 'maplibre-gl';

const connectorWidth = 2;
const connectorOutlineWidth = 1;
const controlPointRadius = 5;
const controlPointOutlineWidth = 2;
const controlPointCandidateRadius = 3;
const controlPointCandidateOutlineWidth = 1;
const controlPointControlsWidth = 300;
const controlPointControlsHeight = 120;

const highwayGraphMinZoom = 12;

export function PlanMap({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: EditorDispatch;
}) {
  return (
    <MapComponent>
      <RouteMapComponent state={state} dispatch={dispatch} />
    </MapComponent>
  );
}

function RouteMapComponent({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: EditorDispatch;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const highways = useHighwayGraph();
  const map = useMap();

  useOnMap('click', (ev) => {
    dispatch({
      type: 'push',
      payload: {
        lngLat: [ev.lngLat.lng, ev.lngLat.lat],
      },
    });
  });

  const cancelLoad = useRef<Dispatch<void> | undefined>();
  const updateGraph = useCallback(
    (map: ml.Map) => {
      cancelLoad.current?.();
      cancelLoad.current = undefined;
      if (map.getZoom() >= highwayGraphMinZoom) {
        cancelLoad.current = highways.load(mapBBox(map));
      }
    },
    [highways],
  );
  useEffect(() => {
    updateGraph(map);
    return () => {
      cancelLoad.current?.();
      cancelLoad.current = undefined;
    };
  }, [updateGraph, map]);
  useOnMap('moveend', (_ev, map) => updateGraph(map));

  return (
    <svg
      className="w-full h-full pointer-events-[click]"
      onMouseDown={(ev) => ev.preventDefault()}
      ref={ref}
    >
      {state.points.map(
        (p, i) =>
          i < state.points.length - 1 && (
            <MapControlConnector
              key={p.id}
              point={p}
              next={state.points[i + 1]!}
              activeCandidate={
                state.activeCandidate?.after === p.id
                  ? state.activeCandidate
                  : null
              }
              dispatch={dispatch}
            />
          ),
      )}

      {state.points.map(
        (p, i) =>
          i < state.points.length - 1 && (
            <MapControlPointCandidate
              key={p.id + '/' + state.points[i + 1]!.id}
              point={p}
              next={state.points[i + 1]!}
              active={
                state.activeCandidate?.after === p.id
                  ? state.activeCandidate
                  : null
              }
              dispatch={dispatch}
            />
          ),
      )}

      {state.points.map((p) => (
        <MapControlPoint key={p.id} point={p} dispatch={dispatch} />
      ))}

      {state.points.map((p, i) => (
        <MapControlPointControlsContainer
          key={p.id}
          point={p}
          dispatch={dispatch}
          i={i}
        />
      ))}
    </svg>
  );
}

function MapControlConnector({
  point,
  next,
  activeCandidate,
}: {
  point: ControlPoint;
  next: ControlPoint;
  activeCandidate: ActiveCandidate | null;
  dispatch: EditorDispatch;
}) {
  const map = useMap();
  const ref = useRef<SVGPathElement>(null);
  const outlineRef = useRef<SVGPathElement>(null);

  const render = useCallback(
    (
      point: ControlPoint,
      next: ControlPoint,
      activeCandidate: ActiveCandidate | null,
    ) => {
      const pt = map.project(point.lngLat);
      const nextPt = map.project(next.lngLat);

      let path: string[] | undefined;
      if (activeCandidate) {
        const activePt = map.project(activeCandidate.lngLat);
        path = [
          `M${pt.x},${pt.y}`,
          `L${activePt.x},${activePt.y}`,
          `L${nextPt.x},${nextPt.y}`,
        ];
      } else {
        path = [`M${pt.x},${pt.y}`, `L${nextPt.x},${nextPt.y}`];
      }

      if (path) {
        const dValue = path.join(' ');
        outlineRef.current?.setAttribute('d', dValue);
        ref.current?.setAttribute('d', dValue);
      }
    },
    [map],
  );

  useOnMap('render', () => render(point, next, activeCandidate));
  useEffect(
    () => render(point, next, activeCandidate),
    [render, point, next, activeCandidate],
  );

  return (
    <g className="pointer-events-auto group fill-none">
      <path
        ref={outlineRef}
        strokeWidth={connectorWidth + connectorOutlineWidth * 2}
        className="stroke-white"
      />
      <path
        ref={ref}
        strokeWidth={connectorWidth}
        className="stroke-blue-800 group-hover:stroke-blue-500"
      />
    </g>
  );
}

function MapControlPoint({
  point,
  dispatch,
}: {
  point: ControlPoint;
  dispatch: EditorDispatch;
}) {
  const map = useMap();
  const ref = useRef<SVGCircleElement>(null);
  const labelRef = useRef<SVGTextElement>(null);
  const id = point.id;

  const pointRef = useRef(point);
  pointRef.current = point;

  // Render

  const render = useCallback(
    (point: ControlPoint) => {
      const pt = map.project(point.lngLat);

      ref.current?.setAttribute('cx', pt.x.toString());
      ref.current?.setAttribute('cy', pt.y.toString());

      labelRef.current?.setAttribute(
        'x',
        (pt.x + controlPointRadius + controlPointOutlineWidth - 2).toString(),
      );
      labelRef.current?.setAttribute(
        'y',
        (pt.y - controlPointRadius - controlPointOutlineWidth + 2).toString(),
      );
    },
    [map],
  );

  useOnMap('render', () => render(point));
  useEffect(() => render(point), [render, point]);

  // Interactivity

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const svg = svgParent(el);

    let activePointer: number | null = null;

    const pressDrags = new Map<
      number,
      { dist: number; last: [number, number] }
    >();

    const onPointerDownHandler = (ev: PointerEvent) => {
      pressDrags.set(ev.pointerId, { dist: 0, last: [ev.clientX, ev.clientY] });

      if (activePointer === null) {
        activePointer = ev.pointerId;
      }
    };

    const onPointerUpHandler = (ev: PointerEvent) => {
      if (activePointer !== null && ev.pointerId === activePointer) {
        activePointer = null;
      }

      const dragData = pressDrags.get(ev.pointerId);
      if (dragData && dragData.dist <= 2) {
        ev.preventDefault();
        dispatch({
          type: 'update',
          payload: { id, showControls: !pointRef.current.showControls },
        });
      }
    };

    const onPointerMoveHandler = (ev: PointerEvent) => {
      let dragData = pressDrags.get(ev.pointerId);
      if (dragData) {
        const pos: [number, number] = [ev.clientX, ev.clientY];
        dragData = {
          dist: dragData.dist + pythagoreanDist(dragData.last, pos),
          last: pos,
        };
        pressDrags.set(ev.pointerId, dragData);
      }

      if (activePointer === null || ev.pointerId !== activePointer) {
        return;
      }
      if (dragData && dragData.dist < 2) {
        return;
      }

      const rect = svg.getBoundingClientRect();
      const pt: [number, number] = [
        clamp(ev.clientX - rect.left, 0, rect.width),
        clamp(ev.clientY - rect.top, 0, rect.height),
      ];
      const lngLat = map.unproject(pt);

      dispatch({
        type: 'update',
        payload: { id, lngLat: [lngLat.lng, lngLat.lat] },
      });
    };

    el.addEventListener('pointerdown', onPointerDownHandler);
    window.addEventListener('pointerup', onPointerUpHandler);
    window.addEventListener('pointermove', onPointerMoveHandler);

    return () => {
      el.removeEventListener('pointerdown', onPointerDownHandler);
      window.removeEventListener('pointerup', onPointerUpHandler);
      window.removeEventListener('pointermove', onPointerMoveHandler);
    };
  }, [id, map, dispatch]);

  return (
    <>
      <circle
        r={controlPointRadius}
        strokeWidth={controlPointOutlineWidth}
        className="stroke-white fill-blue-800 hover:fill-blue-500 pointer-events-auto"
        ref={ref}
      />

      <text
        ref={labelRef}
        stroke="white"
        stroke-width="0.4em"
        fill="black"
        paintOrder="stroke"
        strokeLinejoin="round"
        fontSize="0.75rem"
      >
        {point.waypoint?.name}
      </text>
    </>
  );
}

function MapControlPointControlsContainer({
  point,
  dispatch,
  i,
}: {
  point: ControlPoint;
  dispatch: EditorDispatch;
  i: number;
}) {
  const ref = useRef<SVGForeignObjectElement>(null);
  const map = useMap();
  const isOpen = !!point.showControls;

  const render = useCallback(
    (point: ControlPoint) => {
      const pt = map.project(point.lngLat);
      ref.current?.setAttribute(
        'x',
        (pt.x + controlPointRadius + controlPointOutlineWidth).toString(),
      );
      ref.current?.setAttribute(
        'y',
        (
          pt.y -
          controlPointControlsHeight -
          controlPointRadius -
          controlPointOutlineWidth
        ).toString(),
      );
    },
    [map],
  );
  useOnMap('render', () => render(point));
  useEffect(() => render(point), [render, point]);

  useEffect(() => {
    if (point.showControls) {
      const handler = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          dispatch({
            type: 'toggleControls',
            payload: { id: point.id },
          });
        }
      };
      window.addEventListener('keydown', handler);
      return () => {
        window.removeEventListener('keydown', handler);
      };
    }
  }, [dispatch, point.id, point.showControls]);

  return (
    <foreignObject
      ref={ref}
      width={controlPointControlsWidth}
      height={controlPointControlsHeight}
    >
      <div
        className={cls(
          'relative w-full h-full max-w-full max-h-full bg-white p-2 rounded border border-gray-200',
          'transition motion-reduce:transition-none',
          isOpen
            ? 'scale-y-100 opacity-100 pointer-events-auto'
            : 'scale-y-50 opacity-0 pointer-events-none',
        )}
        onMouseDown={(ev) => {
          if (isOpen) {
            ev.stopPropagation();
          }
        }}
      >
        <button
          className="absolute top-0.5 right-0.5"
          onClick={() =>
            dispatch({
              type: 'toggleControls',
              payload: { id: point.id },
            })
          }
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        <div className="w-full h-full max-w-full max-h-full overflow-auto">
          {isOpen && (
            <ControlPointControls point={point} i={i} dispatch={dispatch} />
          )}
        </div>
      </div>
    </foreignObject>
  );
}

function MapControlPointCandidate({
  point,
  next,
  dispatch,
  active,
}: {
  point: ControlPoint;
  next: ControlPoint;
  dispatch: EditorDispatch;
  active: ActiveCandidate | null;
}) {
  const map = useMap();
  const ref = useRef<SVGCircleElement>(null);
  const id = point.id;

  const pointRef = useRef(point);
  pointRef.current = point;

  const nextRef = useRef(next);
  nextRef.current = next;

  // Render

  const render = useCallback(
    (
      point: ControlPoint,
      next: ControlPoint,
      active: ActiveCandidate | null,
    ) => {
      let x: number;
      let y: number;
      if (active) {
        const pt = map.project(active.lngLat);
        x = pt.x;
        y = pt.y;
      } else {
        const pt1 = map.project(point.lngLat);
        const pt2 = map.project(next.lngLat);
        x = (pt2.x + pt1.x) / 2;
        y = (pt2.y + pt1.y) / 2;
      }
      ref.current?.setAttribute('cx', x.toString());
      ref.current?.setAttribute('cy', y.toString());
    },
    [map],
  );

  useOnMap('render', () => render(point, next, active));
  useEffect(() => render(point, next, active), [render, point, next, active]);

  // Interactivity

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const svg = svgParent(el);

    let activePointer: number | null = null;

    const onPointerDownHandler = (ev: PointerEvent) => {
      if (activePointer === null) {
        activePointer = ev.pointerId;

        const pt1 = map.project(pointRef.current.lngLat);
        const pt2 = map.project(nextRef.current.lngLat);
        const x = (pt2.x + pt1.x) / 2;
        const y = (pt2.y + pt1.y) / 2;
        const lngLat = map.unproject([x, y]);
        dispatch({
          type: 'setActiveCandidate',
          payload: {
            after: pointRef.current.id,
            lngLat: [lngLat.lng, lngLat.lat],
          },
        });
      }
    };

    const onPointerUpHandler = (ev: PointerEvent) => {
      if (ev.pointerId === activePointer) {
        activePointer = null;
        dispatch({ type: 'promoteActiveCandidate' });
      }
    };

    const onPointerMoveHandler = (ev: PointerEvent) => {
      if (activePointer === null || ev.pointerId !== activePointer) {
        return;
      }

      const rect = svg.getBoundingClientRect();
      const pt: [number, number] = [
        clamp(ev.clientX - rect.left, 0, rect.width),
        clamp(ev.clientY - rect.top, 0, rect.height),
      ];
      const lngLat = map.unproject(pt);

      dispatch({
        type: 'setActiveCandidate',
        payload: {
          after: pointRef.current.id,
          lngLat: [lngLat.lng, lngLat.lat],
        },
      });
    };

    el.addEventListener('pointerdown', onPointerDownHandler);
    window.addEventListener('pointerup', onPointerUpHandler);
    window.addEventListener('pointermove', onPointerMoveHandler);

    return () => {
      el.removeEventListener('pointerdown', onPointerDownHandler);
      window.removeEventListener('pointerup', onPointerUpHandler);
      window.removeEventListener('pointermove', onPointerMoveHandler);
    };
  }, [id, map, dispatch]);

  return (
    <circle
      r={active ? controlPointRadius : controlPointCandidateRadius}
      strokeWidth={
        active ? controlPointOutlineWidth : controlPointCandidateOutlineWidth
      }
      className="stroke-white fill-blue-800 hover:fill-blue-500 pointer-events-auto"
      ref={ref}
    />
  );
}

function svgParent(el: SVGElement): SVGSVGElement {
  for (;;) {
    if (el.tagName.toUpperCase() === 'SVG') {
      return el as SVGSVGElement;
    }

    if (
      el.parentElement === null ||
      !(el.parentElement instanceof SVGElement)
    ) {
      throw new Error('not in svg');
    }

    el = el.parentElement;
  }
}
