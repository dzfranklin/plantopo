import { Scene } from '../api/SyncEngine/Scene';
import * as ml from 'maplibre-gl';
import { MapSources } from '../api/mapSources';

export class LayerRenderer {
  private _pendingTilesets = new Set<string>();
  private _addedSprites = new Set<string>();
  private _currentSublayers = new Set<string>();
  private _map: ml.Map;
  private _sources: MapSources;
  private _scene: Scene | null = null;
  private _boundOnPotentialLoad = this._onPotentialLoad.bind(this);

  constructor(map: ml.Map, sources: MapSources) {
    this._map = map;
    this._sources = sources;
    map.on('data', this._boundOnPotentialLoad);
  }

  remove() {
    this._map.off('data', this._boundOnPotentialLoad);
    for (const sublayer of this._currentSublayers) {
      this._map.removeLayer(sublayer);
    }
    for (const sprite of this._addedSprites) {
      this._map.removeSprite(sprite);
    }
  }

  render(scene: Scene): void {
    this._render(scene);
  }

  private _render(scene: Scene, hasNewTilesetsLoaded = false) {
    const active = scene.layers.active;
    const prevActive = this._scene?.layers.active;

    let orderDirty = false;
    if (
      hasNewTilesetsLoaded ||
      !prevActive ||
      prevActive.length !== active.length
    ) {
      orderDirty = true;
    } else {
      for (let i = 0; i < active.length; i++) {
        if (prevActive[i]!.id !== active[i]!.id) {
          orderDirty = true;
          break;
        }
      }
    }

    let missingDeps = false;
    for (const { source } of active) {
      for (const ts of source.sublayerTilesets) {
        if (this._map.getSource(ts)) {
          missingDeps = !this._map.isSourceLoaded(ts);
        } else {
          this._map.addSource(ts, this._sources.tilesets[ts]!);
          this._pendingTilesets.add(ts);
          missingDeps = true;
        }
      }

      if (source.sprites && !this._addedSprites.has(source.sprites)) {
        // We don't need to wait for sprites to load before we can use them
        this._addedSprites.add(source.sprites);
        const url = this._sources.sprites[source.sprites]!;
        this._map.addSprite(source.sprites, url);
      }
    }

    // Wait until everything is loaded before we change
    if (!missingDeps && orderDirty) {
      // Clear existing
      if (prevActive) {
        for (const layer of prevActive) {
          for (const subl of layer.source.sublayers) {
            if (this._currentSublayers.has(subl.id)) {
              this._map.removeLayer(subl.id);
            }
          }
        }
      }

      // Add new
      for (let layerI = active.length - 1; layerI >= 0; layerI--) {
        const layer = active[layerI]!;
        const sublayers = layer.source.sublayers;
        for (const sublayer of sublayers) {
          this._map.addLayer(sublayer);
          this._currentSublayers.add(sublayer.id);
        }
      }
    }

    // Set opacity of loaded
    for (const layer of active) {
      let opacity = layer.opacity ?? layer.source.defaultOpacity;
      if (opacity < 0.05) opacity = 0;
      else if (opacity > 0.95) opacity = 1;

      for (const [id, props] of Object.entries(layer.source.sublayerOpacity)) {
        if (!this._currentSublayers.has(id)) {
          continue;
        }

        for (const [name, initialValue] of Object.entries(props)) {
          const value = makeOpacityExpression(initialValue, opacity);
          this._map.setPaintProperty(id, name, value);
        }
      }
    }

    this._scene = scene;
  }

  private _onPotentialLoad() {
    const newTilesets = new Set<string>();
    for (const tileset of this._pendingTilesets) {
      if (this._map.isSourceLoaded(tileset)) {
        if (this._pendingTilesets.delete(tileset)) {
          newTilesets.add(tileset);
        }
      }
    }

    if (!this._scene) {
      // We've never rendered, so we have nothing to update
      return;
    }

    let shouldRender = false;
    for (const layer of this._scene.layers.active) {
      for (const ts of layer.source.sublayerTilesets) {
        if (newTilesets.has(ts)) {
          shouldRender = true;
          break;
        }
      }
    }

    if (shouldRender) {
      // Workaround maplibre being uready for modifications in this callback
      requestAnimationFrame(() => {
        this._render(this._scene!, true);
      });
    }
  }
}

function makeOpacityExpression(
  initialValue: unknown,
  opacity: number,
): unknown {
  if (typeof initialValue === 'number') {
    return initialValue * opacity;
  }

  if (!Array.isArray(initialValue) || initialValue.length === 0) {
    console.error('Cannot make opacity expression for', initialValue);
    return initialValue;
  }
  const name = initialValue[0];
  // the map_sources generate script outputs the expressions we need to support
  switch (name) {
    case 'interpolate':
      return rewriteInterpolateExpr(initialValue, opacity);
    case 'step':
      return rewriteStepExpr(initialValue, opacity);
    default:
      console.error('Cannot make opacity expression for', initialValue);
      return initialValue;
  }
}

function rewriteInterpolateExpr(expr: unknown[], opacity: number): unknown[] {
  const type = expr[1];
  const input = expr[2];
  const out = ['interpolate', type, input];
  for (let i = 3; i < expr.length; i += 2) {
    const input = expr[i];
    const output = expr[i + 1];

    out.push(input);

    if (typeof output == 'number') {
      out.push(output * opacity);
    } else {
      out.push(['*', output, opacity]);
    }
  }
  return out;
}

function rewriteStepExpr(expr: unknown[], opacity: number): unknown[] {
  const out: unknown[] = ['step'];
  for (let i = 1; i < expr.length; i += 2) {
    // Note the first pair in the iteration have different semantics, but we can
    // treat them identically for our purposes
    const input = expr[i];
    const output = expr[i + 1];

    out.push(input);

    if (typeof output === 'number') {
      out.push(output * opacity);
    } else {
      out.push(['*', output, opacity]);
    }
  }
  return out;
}
