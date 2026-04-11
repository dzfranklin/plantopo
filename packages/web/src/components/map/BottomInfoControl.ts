import DOMPurify from "dompurify";
import ml from "maplibre-gl";

import "./BottomInfoControl.css";

// Based on <https://github.com/maplibre/maplibre-gl-js/blob/1fe69fd961d62c9b017debfc7eb49c32c53e5339/src/ui/control/attribution_control.ts>

const DEFAULT_DISTANCE_UNIT = "km";
type DistanceUnit = "km" | "mi" | undefined;

export class BottomInfoControl implements ml.IControl {
  private _map: ml.Map | undefined;
  private _container: HTMLDivElement | undefined;
  private _attributionContainer: HTMLDivElement | undefined;
  private _attribHTML: string | undefined;
  private _scaleContainer: HTMLDivElement | undefined;
  private _scaleLabel: HTMLSpanElement | undefined;
  private _scaleBar: HTMLDivElement | undefined;
  private _osLogo: HTMLDivElement | undefined;
  private _onShowAttributions: (html: string) => void;
  private _distanceUnit: DistanceUnit;

  constructor(
    distanceUnit: DistanceUnit,
    onShowAttributions?: (html: string) => void,
  ) {
    this._onShowAttributions = onShowAttributions ?? alertFullAttribution;
    this._distanceUnit = distanceUnit;
  }

  setDistanceUnit(unit: DistanceUnit) {
    if (this._distanceUnit === unit) return;
    this._distanceUnit = unit;
    this._updateScale();
  }

  onAdd(map: ml.Map): HTMLElement {
    this._map = map;

    this._container = document.createElement("div");
    this._container.className = "bottom-info-control";

    const attribGroup = document.createElement("div");
    attribGroup.className = "bottom-info-control-attrib-group";
    this._container.appendChild(attribGroup);

    this._attributionContainer = document.createElement("div");
    this._attributionContainer.className =
      "bottom-info-control-attrib hover-only-link-container";
    attribGroup.appendChild(this._attributionContainer);

    const expandAttribButton = document.createElement("button");
    expandAttribButton.className = "bottom-info-control-expand-attrib";
    expandAttribButton.type = "button";
    expandAttribButton.setAttribute("aria-label", "Toggle attributions");
    expandAttribButton.innerText = "ⓘ";
    expandAttribButton.addEventListener("click", () => {
      if (this._attribHTML) this._onShowAttributions(this._attribHTML);
    });
    attribGroup.appendChild(expandAttribButton);

    this._scaleContainer = document.createElement("div");
    this._scaleContainer.className = "bottom-info-control-scale";
    this._scaleLabel = document.createElement("span");
    this._scaleContainer.appendChild(this._scaleLabel);
    this._scaleBar = document.createElement("div");
    this._scaleBar.className = "bottom-info-control-scale-bar";
    this._scaleContainer.appendChild(this._scaleBar);
    this._container.appendChild(this._scaleContainer);

    this._osLogo = document.createElement("div");
    this._osLogo.className = "bottom-info-control-os-logo";
    map.getContainer().appendChild(this._osLogo);

    this._updateAttributions();
    this._updateScale();

    this._map.on("styledata", this._updateData);
    this._map.on("sourcedata", this._updateData);
    this._map.on("terrain", this._updateData);
    this._map.on("move", this._updateScale);
    this._map.on("zoom", this._updateScale);

    return this._container;
  }

  onRemove(_map: ml.Map): void {
    this._container?.remove();
    this._osLogo?.remove();

    this._map?.off("styledata", this._updateData);
    this._map?.off("sourcedata", this._updateData);
    this._map?.off("terrain", this._updateData);
    this._map?.off("move", this._updateScale);
    this._map?.off("zoom", this._updateScale);

    this._map = undefined;
    this._attribHTML = undefined;
  }

  getDefaultPosition(): ml.ControlPosition {
    return "bottom-right";
  }

  _updateData = (e: ml.MapDataEvent) => {
    if (
      e &&
      (e.sourceDataType === "metadata" ||
        e.sourceDataType === "visibility" ||
        e.dataType === "style" ||
        e.type === "terrain")
    ) {
      this._updateAttributions();
    }
  };

  _updateAttributions() {
    if (
      !this._map ||
      !this._container ||
      !this._attributionContainer ||
      !this._map.style
    ) {
      return;
    }

    let partsUnsanitized: Array<string> = [];

    const tileManagers = this._map.style.tileManagers;
    for (const id in tileManagers) {
      const tileManager = tileManagers[id];
      if (tileManager?.used || tileManager?.usedForTerrain) {
        const source = tileManager.getSource();
        if (
          source.attribution &&
          partsUnsanitized.indexOf(source.attribution) < 0
        ) {
          partsUnsanitized.push(source.attribution);
        }
      }
    }

    // remove any entries that are whitespace
    partsUnsanitized = partsUnsanitized.filter(e => String(e).trim());

    // remove any entries that are substrings of another entry.
    // first sort by length so that substrings come first
    partsUnsanitized.sort((a, b) => a.length - b.length);
    partsUnsanitized = partsUnsanitized.filter((attrib, i) => {
      for (let j = i + 1; j < partsUnsanitized.length; j++) {
        if (partsUnsanitized[j]!.indexOf(attrib) >= 0) {
          return false;
        }
      }
      return true;
    });

    // Add MapLibre attribution
    partsUnsanitized.push('<a href="https://maplibre.org/">MapLibre</a>');

    const htmlUnsanitized = partsUnsanitized.join(" | ");
    const htmlSanitized = this.sanitizeAttributionHTML(htmlUnsanitized);

    const hasOSData = partsUnsanitized.some(p =>
      p.includes("Contains OS data"),
    );
    if (this._osLogo) {
      this._osLogo.style.display = hasOSData ? "block" : "none";
    }

    // check if attribution string is different to minimize DOM changes
    if (htmlUnsanitized !== this._attribHTML) {
      this._attribHTML = htmlSanitized;
      this._attributionContainer.innerHTML = htmlSanitized;
    }
  }

  _updateScale = () => {
    if (
      !this._map ||
      !this._scaleContainer ||
      !this._scaleLabel ||
      !this._scaleBar
    )
      return;

    const maxWidth = 100;
    const mapContainer = this._map.getContainer();
    const y = mapContainer.clientHeight / 2;
    const x = mapContainer.clientWidth / 2;
    const left = this._map.unproject([x - maxWidth / 2, y]);
    const right = this._map.unproject([x + maxWidth / 2, y]);
    const maxMeters = left.distanceTo(right);

    let distance: number;
    let unit: string;
    let inputValue: number;
    const distanceUnit = this._distanceUnit ?? DEFAULT_DISTANCE_UNIT;
    switch (distanceUnit) {
      case "mi": {
        const maxMiles = maxMeters / 1609.344;
        if (maxMiles >= 1) {
          distance = getRoundNum(maxMiles);
          unit = "mi";
          inputValue = maxMiles;
        } else {
          const maxYards = maxMeters / 0.9144;
          distance = getRoundNum(maxYards);
          unit = "yd";
          inputValue = maxYards;
        }
        break;
      }
      case "km": {
        if (maxMeters >= 1000) {
          distance = getRoundNum(maxMeters / 1000);
          unit = "km";
          inputValue = maxMeters / 1000;
        } else {
          distance = getRoundNum(maxMeters);
          unit = "m";
          inputValue = maxMeters;
        }
        break;
      }
    }

    const ratio = distance / inputValue;
    this._scaleLabel.textContent = `${distance}\u00a0${unit}`;
    this._scaleBar.style.width = `${Math.round(maxWidth * ratio)}px`;
  };

  sanitizeAttributionHTML(html: string): string {
    if (html.length === 0) return "";

    html = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["a"],
      ALLOWED_ATTR: ["href"],
    });

    const el = document.createElement("div");
    el.innerHTML = html;
    const anchors = el.getElementsByTagName("a");
    for (const anchor of anchors) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }

    return el.innerHTML;
  }
}

function getRoundNum(num: number): number {
  const pow10 = Math.pow(10, `${Math.floor(num)}`.length - 1);
  let d = num / pow10;
  d =
    d >= 10
      ? 10
      : d >= 5
        ? 5
        : d >= 3
          ? 3
          : d >= 2
            ? 2
            : d >= 1
              ? 1
              : getDecimalRoundNum(d);
  return pow10 * d;
}

function getDecimalRoundNum(d: number): number {
  const multiplier = Math.pow(10, Math.ceil(-Math.log(d) / Math.LN10));
  return Math.round(d * multiplier) / multiplier;
}

/** A basic default in case we are not configured with handler */
function alertFullAttribution(html: string) {
  alert(
    html
      .split(/<br\s*\/?>/i)
      .map(line => line.replace(/<[^>]+>/g, "").trim())
      .filter(line => line.length > 0)
      .join("\n"),
  );
}
