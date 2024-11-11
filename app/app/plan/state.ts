import { Dispatch } from 'react';

export interface EditorState {
  nextID: number;
  points: Array<ControlPoint>;
  activeCandidate?: ActiveCandidate;
}

export interface ControlPoint {
  id: number;
  lngLat: [number, number];
  waypoint?: Waypoint;
  showControls?: boolean;
}

export interface Waypoint {
  name?: string;
}

export interface ActiveCandidate {
  after: number;
  lngLat: [number, number];
}

export const initialEditorState: EditorState = {
  nextID: 1,
  points: [],
};

export type InsertControlPoint = Omit<ControlPoint, 'id'>;

export type EditorAction =
  | {
      type: 'push';
      payload: InsertControlPoint;
    }
  | {
      type: 'update';
      payload: Partial<ControlPoint> & Pick<ControlPoint, 'id'>;
    }
  | { type: 'toggleControls'; payload: { id: number } }
  | {
      type: 'insert';
      payload: { after: number; point: InsertControlPoint };
    }
  | { type: 'delete'; payload: { id: number } }
  | {
      type: 'setActiveCandidate';
      payload: ActiveCandidate | null;
    }
  | { type: 'promoteActiveCandidate' }
  | {
      type: 'updateWaypoint';
      payload: { id: number; waypoint: Partial<Waypoint> | undefined };
    };

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case 'push':
      return {
        ...s,
        nextID: s.nextID + 1,
        points: [...s.points, { ...a.payload, id: s.nextID }],
      };
    case 'update':
      return {
        ...s,
        points: s.points.map((p) =>
          p.id === a.payload.id ? { ...p, ...a.payload } : p,
        ),
      };
    case 'toggleControls':
      return {
        ...s,
        points: s.points.map((p) =>
          p.id === a.payload.id ? { ...p, showControls: !p.showControls } : p,
        ),
      };
    case 'insert': {
      const points: Array<ControlPoint> = [];
      for (const p of s.points) {
        points.push(p);
        if (p.id === a.payload.after) {
          points.push({ ...a.payload.point, id: s.nextID });
        }
      }
      return { ...s, nextID: s.nextID + 1, points };
    }
    case 'delete': {
      let activeCandidate = s.activeCandidate;
      if (activeCandidate && activeCandidate.after === a.payload.id) {
        activeCandidate = undefined;
      }

      return {
        ...s,
        points: s.points.filter((p) => p.id !== a.payload.id),
        activeCandidate,
      };
    }
    case 'setActiveCandidate': {
      return { ...s, activeCandidate: a.payload ?? undefined };
    }
    case 'promoteActiveCandidate': {
      const points: Array<ControlPoint> = [];
      for (const p of s.points) {
        points.push(p);
        if (p.id === s.activeCandidate?.after) {
          points.push({ id: s.nextID, lngLat: s.activeCandidate.lngLat });
        }
      }
      return { ...s, nextID: s.nextID + 1, activeCandidate: undefined, points };
    }
    case 'updateWaypoint': {
      return {
        ...s,
        points: s.points.map((p) =>
          p.id === a.payload.id
            ? {
                ...p,
                waypoint: a.payload.waypoint
                  ? { ...p.waypoint, ...a.payload.waypoint }
                  : undefined,
              }
            : p,
        ),
      };
    }
  }
}

export type EditorDispatch = Dispatch<EditorAction>;
