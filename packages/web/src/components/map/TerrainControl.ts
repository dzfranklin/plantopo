// Based on <https://github.com/maplibre/maplibre-gl-js/blob/48caed8321a8e90b4579f37a08219df2c4e590ae/src/ui/control/terrain_control.ts>
import type { TerrainSpecification } from "@maplibre/maplibre-gl-style-spec";
import ml from "maplibre-gl";

export class TerrainControl implements ml.IControl {
  options: TerrainSpecification;
  private _map: ml.Map | undefined;
  private _container: HTMLElement | undefined;
  private _terrainButton: HTMLButtonElement | undefined;
  private _enabled = false;

  constructor(options: TerrainSpecification) {
    this.options = options;
  }

  onAdd(map: ml.Map): HTMLElement {
    this._map = map;

    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this._terrainButton = document.createElement("button");
    this._terrainButton.className = "maplibregl-ctrl-terrain";
    this._container.appendChild(this._terrainButton);

    const icon = document.createElement("span");
    icon.className = "maplibregl-ctrl-icon";
    icon.setAttribute("aria-hidden", "true");
    this._terrainButton.appendChild(icon);

    this._terrainButton.type = "button";
    this._terrainButton.addEventListener("click", this._toggleTerrain);

    if (this._map.isStyleLoaded()) {
      this._update();
    } else {
      this._map.once("style.load", this._update);
    }
    this._map.on("terrain", this._updateButton);
    this._map.on("plantopo:stylechange", this._update);

    return this._container;
  }

  onRemove() {
    this._container?.remove();

    this._map?.off("terrain", this._updateButton);
    this._map?.off("plantopo:stylechange", this._update);

    this._map = undefined;
    this._container = undefined;
    this._terrainButton = undefined;
  }

  _toggleTerrain = () => {
    this._enabled = !this._enabled;
    this._updateMap();
  };

  _update = () => {
    this._updateMap();
    this._updateButton();
  };

  _updateMap = () => {
    if (!this._map) return;
    if (this._enabled) {
      this._map.setTerrain(this.options);
    } else {
      this._map.setTerrain(null);
    }
  };

  _updateButton = () => {
    if (!this._map || !this._terrainButton) return;
    if (this._enabled) {
      this._terrainButton.classList.add("maplibregl-ctrl-terrain-enabled");
      this._terrainButton.classList.remove("maplibregl-ctrl-terrain");
      this._terrainButton.title = "Disable terrain";
    } else {
      this._terrainButton.classList.add("maplibregl-ctrl-terrain");
      this._terrainButton.classList.remove("maplibregl-ctrl-terrain-enabled");
      this._terrainButton.title = "Enable terrain";
    }
  };
}
