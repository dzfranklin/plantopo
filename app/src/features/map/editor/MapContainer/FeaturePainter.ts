import { RenderFeature } from './FeatureRenderer';
import * as GeoJSON from 'geojson';
import { CurrentCameraPosition as CurrentCamera } from '../CurrentCamera';

const { PI } = Math;

export class FeaturePainter {
  dpi: number;
  showDebug = true;
  c: CanvasRenderingContext2D;

  constructor(public canvas: HTMLCanvasElement) {
    this.dpi = window.devicePixelRatio || 1;
    this.c = canvas.getContext('2d')!;
  }

  paint(camera: CurrentCamera, render: RenderFeature[]): void {
    this.c.save();
    this.c.scale(this.dpi, this.dpi); // Works with the css scale we do
    this.c.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const feature of render) {
      this._paint(camera, feature);
    }

    if (this.showDebug) {
      this.c.strokeStyle = 'red';
      this.c.strokeText(`${render.length} features`, this.canvas.width / 2, 30);
    }

    this.c.restore();
  }

  private _paint(camera: CurrentCamera, feature: RenderFeature): void {
    this.c.save();
    switch (feature.geometry.type) {
      case 'Point':
        this._paintPoint(camera, feature);
        break;
      case 'LineString':
        this._paintLineString(camera, feature);
        break;
    }
    this.c.restore();
  }

  private _paintPoint(camera: CurrentCamera, feature: RenderFeature): void {
    const geo = feature.geometry as GeoJSON.Point;
    const [lng, lat] = geo.coordinates as [number, number];
    const center = camera.project([lng, lat]);
    this.c.translate(center[0], center[1]);

    const dotR = 5;

    this.c.save();
    this.c.beginPath();
    this.c.fillStyle = feature.color;
    this.c.arc(0, 0, dotR, 0, 2 * PI);
    this.c.closePath();
    this.c.fill();
    this.c.restore();

    if (feature.selectedByMe) {
      this.c.save();
      this.c.strokeStyle = '#e5f0ff';
      this.c.lineWidth = 3;
      this.c.beginPath();
      this.c.arc(0, 0, dotR + this.c.lineWidth / 2, 0, 2 * PI);
      this.c.stroke();
      this.c.restore();
    }
  }

  private _paintLineString(camera: CurrentCamera, feature: RenderFeature) {
    // TODO:
  }
}