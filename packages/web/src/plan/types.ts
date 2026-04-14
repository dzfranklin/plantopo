import type { Point, Point3 } from "@pt/shared";

/* Thoughts
Snapping should also snap the point sometimes
Should we hang data off the segment or off the point?
If you drag a middle point and it is snapped onto a path, we want that consistently for the path before and the path after. So that should be a three point query to the routing api.
*/

export interface Segment {
  id: number;
  to: {
    lngLat: Point;
    waypoint?: Waypoint;
  };
  lastModified: number;
  snapIntent: SnapIntent;
  shape?: Point3[];
}

export type SnapIntent = "none" | "routes";

export interface Waypoint {
  name: string;
}
