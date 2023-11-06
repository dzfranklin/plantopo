import { floor2 } from '@/generic/vector2';
import { CurrentCameraPosition as CurrentCamera } from '../CurrentCamera';
import {
  RenderFeature,
  RenderList,
  RenderItem,
  RenderFeatureHandle,
} from './FeatureRenderer';
import { LineStringSyncGeometry, PointSyncGeometry } from '@/gen/sync_schema';

const { PI } = Math;

const selectionOutlineColor = 'hsla(360, 0%, 94%, 1)';

export class FeaturePainter {
  dpi: number;
  public showDebug = true;

  constructor(
    public canvas: HTMLCanvasElement,
    public c: CanvasRenderingContext2D,
  ) {
    this.dpi = window.devicePixelRatio || 1;
    this.c = canvas.getContext('2d')!;
  }

  paint(camera: CurrentCamera, render: RenderList): void {
    const start = performance.now();
    this.c.save();
    this.c.scale(this.dpi, this.dpi); // Works with the css scale we do
    this.c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const feature of render.list) {
      this._paint(camera, feature);
    }
    const end = performance.now();

    if (this.showDebug) {
      this._debugLine = 0;
      const { timing } = render;

      this._debugText(`count ${render.list.length}`);
      this._debugTime('scene', timing.scene.end - timing.scene.start);
      this._debugTime('render', timing.end - timing.start);
      this._debugTime('paint', end - start);
    }

    this.c.restore();
  }

  private _paint(camera: CurrentCamera, item: RenderItem): void {
    this.c.save();
    switch (item.type) {
      case 'feature': {
        switch (item.geometry.type) {
          case 'Point':
            this._paintPoint(camera, item.geometry, item);
            break;
          case 'LineString':
            this._paintLineString(camera, item.geometry, item);
            break;
        }
        break;
      }
      case 'handle': {
        this._paintHandle(camera, item);
      }
    }
    this.c.restore();
  }

  private _paintPoint(
    camera: CurrentCamera,
    geo: PointSyncGeometry,
    feature: RenderFeature,
  ): void {
    const center = camera.project(geo.coordinates);
    this.c.translate(center[0], center[1]);

    const dotR = 5;

    this.c.save();
    if (feature.hoveredByMe) {
      this.c.shadowBlur = 8;
      this.c.shadowColor = 'hsla(205, 36%, 54%, 1)';

      this.c.beginPath();
      this.c.fillStyle = 'hsl(0, 0%, 70%)';
      this.c.arc(0, 0, dotR, 0, 2 * PI);
      this.c.closePath();
      this.c.fill();
      this.c.globalCompositeOperation = 'overlay';
    }
    this.c.beginPath();
    this.c.fillStyle = feature.color;
    this.c.arc(0, 0, dotR, 0, 2 * PI);
    this.c.closePath();
    this.c.fill();
    this.c.restore();

    if (feature.selectedByMe && !feature.active) {
      this.c.beginPath();
      this.c.lineWidth = 3;
      this.c.strokeStyle = selectionOutlineColor;
      this.c.arc(0, 0, dotR + this.c.lineWidth / 2, 0, 2 * PI);
      this.c.stroke();
    }

    if (feature.name) {
      this.c.strokeText(feature.name, 0, 0); // TODO:
    }
  }

  private _paintLineString(
    camera: CurrentCamera,
    geo: LineStringSyncGeometry,
    feature: RenderFeature,
  ): void {
    if (geo.coordinates.length === 0) return;

    this.c.save();

    this.c.lineWidth = 3;
    this.c.strokeStyle = feature.color;
    this.c.lineCap = 'round';
    this.c.lineJoin = 'round';

    if (feature.selectedByMe && !feature.active) {
      this.c.save();
      this.c.lineWidth += 6;
      this.c.strokeStyle = selectionOutlineColor;
      this.c.beginPath();
      for (const [i, coord] of geo.coordinates.entries()) {
        const p = floor2(camera.project(coord));
        if (i === 0) this.c.moveTo(p[0], p[1]);
        else this.c.lineTo(p[0], p[1]);
      }
      this.c.stroke();
      this.c.restore();
    }

    this.c.beginPath();
    for (const [i, coord] of geo.coordinates.entries()) {
      const p = floor2(camera.project(coord));
      if (i === 0) this.c.moveTo(p[0] + 0.5, p[1] + 0.5);
      else this.c.lineTo(p[0], p[1]);
    }
    this.c.stroke();

    this.c.restore();
  }

  private _paintHandle(camera: CurrentCamera, h: RenderFeatureHandle): void {
    this.c.save();
    const center = camera.project(h.geometry.coordinates);
    this.c.beginPath();
    this.c.fillStyle = h.feature.color;
    this.c.strokeStyle = selectionOutlineColor;
    const w = h.handleType === 'midpoint' ? 2 : 3;
    const r = h.handleType === 'midpoint' ? 4 : 7;
    this.c.lineWidth = w;
    this.c.arc(center[0], center[1], r, 0, 2 * PI);
    this.c.closePath();
    this.c.fill();
    this.c.stroke();
    this.c.restore();
  }

  private _debugTime(label: string, ms: number) {
    if (!this.showDebug) return;
    this._debugText(`${label}: ${ms.toFixed(1)}ms`);
  }

  private _debugLine = 0;
  private _debugText(text: string): void {
    if (!this.showDebug) return;
    this.c.save();
    this.c.translate(
      this.canvas.width / this.dpi - 120,
      this.canvas.height / this.dpi / 2 + this._debugLine * 10,
    );
    this.c.strokeStyle = 'red';
    this.c.strokeText(text, 0, 0);
    this.c.restore();
    this._debugLine++;
  }
}
