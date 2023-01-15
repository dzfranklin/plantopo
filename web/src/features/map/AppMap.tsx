import { useEffect, useRef, useState } from "react";
import Map from "ol/Map.js";
import TileLayer from "ol/layer/Tile.js";
import View from "ol/View.js";
import "ol/ol.css";
import LeisureSource from "./os_source/LeisureSource";
import { OSBrandLogo } from "./os_source/Brand";
import { ProjectionLike, transform, transformExtent } from "ol/proj";
import BaseLayer from "ol/layer/Base";
import { Coordinate } from "ol/coordinate";
import { get as getProj } from "ol/proj";

export interface MapProps {
  primaryLayer: PrimaryLayerSpec;
}

interface PrimaryLayerSpec {
  proj: string;
  factory: () => BaseLayer;
  resolutions?: number[];
}

export function AppMapDemo() {
  const baseLayer = {
    proj: "EPSG:27700",
    factory: () =>
      new TileLayer({
        source: new LeisureSource({
          // TODO
          key: "TODO",
        }),
      }),
    resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
  };

  return <AppMap primaryLayer={baseLayer} />;
}

export default function AppMap(props: MapProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const map = useMap(nodeRef, props.primaryLayer);

  return (
    <div ref={nodeRef} className="w-full h-full">
      <OSBrandLogo />
    </div>
  );
}

function useMap(
  targetRef: React.RefObject<HTMLDivElement>,
  baseLayer: PrimaryLayerSpec
) {
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (target === null) throw new Error("expected nodeRef non-null");

    if (mapRef.current === null) {
      mapRef.current = new Map({
        target,
      });
    }
  }, [targetRef]);

  useEffect(() => {
    const map = mapRef.current!;

    map.getLayers().setAt(0, baseLayer.factory());

    const prevView = map.getView();
    const view = new View({
      projection: baseLayer.proj,
      resolutions: baseLayer.resolutions,
      center: transformCenter(
        prevView.getCenter(),
        prevView.getProjection(),
        baseLayer.proj
      ),
      resolution: transformResolution(
        prevView.getResolution(),
        prevView.getProjection(),
        baseLayer.proj
      ),
    });
    map.setView(view);
  }, [baseLayer]);
}

function transformCenter(
  center: Coordinate | undefined,
  src: ProjectionLike,
  dst: ProjectionLike
): Coordinate | undefined {
  if (center === undefined) return;
  return transform(center, src, dst);
}

function transformResolution(
  res: number | undefined,
  src: ProjectionLike,
  dst: ProjectionLike
): number | undefined {
  if (res === undefined) return;
  // res is in projection units per pixel
  let srcMetersPerUnit = getProj(src)?.getMetersPerUnit();
  let dstMetersPerUnit = getProj(dst)?.getMetersPerUnit();
  if (srcMetersPerUnit === undefined || dstMetersPerUnit === undefined) {
    throw new Error(
      "src and dst must be valid projections with meters per unit"
    );
  }
  return (res / srcMetersPerUnit) * dstMetersPerUnit;
}
