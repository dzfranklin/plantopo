import ml from "maplibre-gl";

/** Snaps zoom to integer levels after a gesture ends. Returns a detach function. */
export function attachZoomSnap(map: ml.Map): () => void {
  let zoomStart: number | null = null;
  let zoomAround: ml.LngLat | null = null;

  const onZoomStart = (e: ml.MapLibreZoomEvent) => {
    if (!e.originalEvent) return;
    zoomStart = map.getZoom();
    zoomAround = null; // reset so stale position isn't reused
  };

  const onZoom = (e: ml.MapLibreZoomEvent) => {
    // Track the latest pointer position throughout the gesture so the snap
    // animates around the right point.
    const orig = e.originalEvent as Event | undefined;
    if (!orig) return;
    let clientX: number, clientY: number;
    const touch =
      "touches" in orig ? (orig as TouchEvent).touches.item(0) : null;
    if (touch) {
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (orig as MouseEvent).clientX;
      clientY = (orig as MouseEvent).clientY;
    }
    if (clientX === 0 && clientY === 0) return; // synthetic / no position
    const rect = map.getContainer().getBoundingClientRect();
    const point = new ml.Point(clientX - rect.left, clientY - rect.top);
    zoomAround = map.unproject(point);
  };

  const onZoomEnd = (e: ml.MapLibreZoomEvent) => {
    if (!e.originalEvent) return;
    const current = map.getZoom();
    const start = zoomStart;
    const around = zoomAround ?? undefined;
    zoomStart = null;
    zoomAround = null;
    // Direction determined from where the gesture started, not the end value,
    // so that a small zoom-out doesn't snap back up.
    const zoomingOut = start !== null && current < start;
    const snapped = zoomingOut ? Math.floor(current) : Math.ceil(current);
    if (current !== snapped) {
      requestAnimationFrame(() =>
        map.easeTo({ zoom: snapped, duration: 130, around }),
      );
    }
  };

  map.on("zoomstart", onZoomStart);
  map.on("zoom", onZoom);
  map.on("zoomend", onZoomEnd);

  return () => {
    map.off("zoomstart", onZoomStart);
    map.off("zoom", onZoom);
    map.off("zoomend", onZoomEnd);
  };
}
