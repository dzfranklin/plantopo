import Point from "@mapbox/point-geometry";

export function mousePos(el: HTMLElement, e: MouseEvent | Touch): Point {
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width / (el.offsetWidth || 1);
  const scaleY = rect.height / (el.offsetHeight || 1);
  return new Point(
    (e.clientX - rect.left) / scaleX - el.clientLeft,
    (e.clientY - rect.top) / scaleY - el.clientTop,
  );
}

export function touchPos(el: HTMLElement, touches: TouchList): Point[] {
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width / (el.offsetWidth || 1);
  const scaleY = rect.height / (el.offsetHeight || 1);
  return Array.from(touches).map(
    t =>
      new Point(
        (t.clientX - rect.left) / scaleX - el.clientLeft,
        (t.clientY - rect.top) / scaleY - el.clientTop,
      ),
  );
}
