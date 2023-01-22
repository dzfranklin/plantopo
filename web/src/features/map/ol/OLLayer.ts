import OlMap, { FrameState } from "ol/Map";
import TileQueue, { getTilePriority } from "ol/TileQueue.js";
import { Map as MlMap } from "maplibre-gl";
import { CustomLayerInterface } from "maplibre-gl";
import "ol/ol.css";
import Tile from "ol/Tile";
import { Coordinate } from "ol/coordinate";
import { DROP } from "ol/structs/PriorityQueue";
import Layer from "ol/layer/Layer";

export interface Options {
  layer: Layer;
}

// prettier-ignore
type mat4 =
  | [number, number, number, number, number, number, number, number, number,
    number, number, number, number, number, number, number] | Float32Array;

export class OLLayer implements CustomLayerInterface {
  id = "openlayers";
  type: "custom" = "custom";

  ml?: MlMap;
  ol: Layer;
  tileQueue: TileQueue;
  canvas: OffscreenCanvas;
  frameState: FrameState;

  constructor(options: Options) {
    this.ol = options.layer;

    this.canvas = new OffscreenCanvas(1, 1);
    // OffscreenCanvas does not have a style, so we mock it
    (this.canvas as any).style = {};

    this.tileQueue = new TileQueue(
      this.tilePriorityFunction.bind(this),
      this.onTileChange.bind(this)
    );

    const todo = null;

    this.frameState = {
      animate: false,
      coordinateToPixelTransform: todo,
      declutterTree: null,
      extent: todo,
      index: 0,
      layerIndex: 0,
      layerStatesArray: [],
      pixelRatio: 1,
      pixelToCoordinateTransform: todo,
      postRenderFunctions: [],
      size: [1, 1],
      tileQueue: this.tileQueue,
      time: null,
      usedTiles: null,
      viewState: null,
      viewHints: null,
      wantedTiles: null,
      mapId: null,
      renderTargets: null,
    };
  }

  tilePriorityFunction(
    tile: Tile,
    tileSourceKey: string,
    tileCenter: Coordinate,
    tileResolution: number
  ): number {
    return getTilePriority(
      this.frameState,
      tile,
      tileSourceKey,
      tileCenter,
      tileResolution
    );
  }

  onTileChange() {
    this.ml?.triggerRepaint();
  }

  onAdd(ml: MlMap): void {
    this.ml = ml;
  }

  onRemove() {}

  render(gl: WebGLRenderingContext, matrix: mat4): void {
    const ml = this.ml!;
    const { ol, frameState, canvas } = this;

    frameState.index += 1;
    frameState.layerStatesArray = ol.getLayerStatesArray();
    frameState.pixelRatio = ml.getPixelRatio();
    frameState.size = [ml.getCanvas().width, ml.getCanvas().height];

    const olR = ol.getRenderer();
    olR?.renderFrame(frameState, canvas as unknown as HTMLElement);

    // olView.setRotation((-Math.PI * ml.getBearing()) / 180);
    // const bounds = ml.getBounds();
    // olView.fit([
    //   bounds.getWest(),
    //   bounds.getSouth(),
    //   bounds.getEast(),
    //   bounds.getNorth(),
    // ]);

    // ol.renderSync();
  }
}
