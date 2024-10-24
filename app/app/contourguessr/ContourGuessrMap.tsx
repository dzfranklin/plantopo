import { useEffect, useMemo, useRef } from 'react';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { olProj27700 } from '@/features/map/crs';
import 'ol/ol.css';
import {
  DragPan,
  DragRotate,
  KeyboardPan,
  KeyboardZoom,
  PinchRotate,
  PinchZoom,
} from 'ol/interaction';
import { Rotate, Zoom } from 'ol/control';
import proj4 from 'proj4';
import VectorSource from 'ol/source/Vector';
import OLGeoJSON from 'ol/format/GeoJSON.js';
import { featureCollection, polygon } from '@turf/helpers';
import VectorLayer from 'ol/layer/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import { Projection } from 'ol/proj';
import PcgRandom from 'pcg-random';
import { viewConfig, ViewID } from '@/app/contourguessr/views';
import { Feature } from 'ol';
import CircleStyle from 'ol/style/Circle';
import { LineString, Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import AttributionControl from 'ol/control/Attribution';

// TODO: Magnifying glass tool: https://openlayers.org/en/latest/examples/magnify.html
//   The difficulty is magnifying the bounds and guess as well. That might require rendering to an intermediate offscreen canvas

export function ContourGuessrMap(props: {
  view: ViewID;
  target: [number, number];
  boundsMeters: number;
  boundsPaddingMeters?: number;
  showAnswer: boolean;
  guess: [number, number] | null;
  setGuess: (_: [number, number] | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const setGuessRef = useRef(props.setGuess);
  setGuessRef.current = props.setGuess;

  const showAnswerRef = useRef(props.showAnswer);
  showAnswerRef.current = props.showAnswer;

  const guessMarkerRef = useRef<Feature | null>(null);
  const answerMarkerRef = useRef<Feature | null>(null);
  const answerLineRef = useRef<Feature | null>(null);

  const view = useMemo(() => viewConfig[props.view], [props.view]);

  const bounds = useMemo(
    () =>
      computeBounds({
        target: props.target,
        viewProjection: viewConfig[props.view].projection,
        boundsMeters: props.boundsMeters,
        boundsPaddingMeters: props.boundsPaddingMeters,
      }),
    [props.view, props.target, props.boundsMeters, props.boundsPaddingMeters],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const guessMarker = new Feature();
    const guessLayer = new VectorLayer({
      source: new VectorSource({ features: [guessMarker] }),
      style: (_f) =>
        new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#387eff' }),
            stroke: new Stroke({
              color: 'white',
              width: 2,
            }),
          }),
        }),
    });
    guessMarkerRef.current = guessMarker;

    const answerMarker = new Feature({ type: 'marker' });
    const answerLine = new Feature({ type: 'line' });
    const answerLayer = new VectorLayer({
      source: new VectorSource({ features: [answerMarker, answerLine] }),
      style: (f) => {
        switch (f.get('type')) {
          case 'marker':
            return new Style({
              image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color: '#009921' }),
                stroke: new Stroke({
                  color: 'white',
                  width: 2,
                }),
              }),
            });
          case 'line':
            return new Style({
              stroke: new Stroke({
                color: '#ababab',
                width: 3,
              }),
            });
        }
      },
    });
    answerMarkerRef.current = answerMarker;
    answerLineRef.current = answerLine;

    const tileLayer = new TileLayer(view.tileLayerConfig);

    const map = new OLMap({
      target: containerRef.current,
      layers: [tileLayer, boundsLayer(bounds), answerLayer, guessLayer],
      view: new View({
        projection: view.projection,
        resolutions: view.resolutions,
        zoom: view.minZoom,
        minZoom: view.minZoom,
        maxZoom: view.maxZoom,
        center: [bounds.centerX, bounds.centerY],
        extent: [
          bounds.viewMinX,
          bounds.viewMinY,
          bounds.viewMaxX,
          bounds.viewMaxY,
        ],
        // Needed because our extent can easily be smaller than the html container
        constrainOnlyCenter: true,
      }),
      controls: [
        new AttributionControl(),
        new Rotate(),
        ...(view.minZoom !== view.maxZoom ? [new Zoom()] : []),
      ],
      interactions: [
        new KeyboardPan(),
        new DragPan(),
        new DragRotate(),
        new PinchRotate(),
        new KeyboardZoom(),
        new PinchZoom(),
      ],
    });

    map.on('singleclick', (evt) => {
      if (showAnswerRef.current) return;

      const [x, y] = evt.coordinate as [number, number];

      if (
        x < bounds.minX ||
        x > bounds.maxX ||
        y < bounds.minY ||
        y > bounds.maxY
      ) {
        setGuessRef.current(null);
        return;
      }

      const guess = proj4(view.projection.getCode(), 'EPSG:4326', [x, y]);
      setGuessRef.current(guess as [number, number]);
    });

    return () => {
      guessMarkerRef.current = null;
      map.setTarget(undefined);
    };
  }, [view, props.target, bounds]);

  useEffect(() => {
    if (!guessMarkerRef.current) return;
    const projection = view.projection;
    setGuess(guessMarkerRef.current, projection, props.guess);
  }, [view, props.guess]);

  useEffect(() => {
    if (!answerMarkerRef.current || !answerLineRef.current) return;
    if (props.showAnswer && props.guess !== null) {
      const projection = view.projection;
      setAnswer(
        answerMarkerRef.current,
        answerLineRef.current,
        projection,
        props.target,
        props.guess,
      );
    }
  }, [view, props.showAnswer, props.target, props.guess]);

  return (
    <div className="relative w-full max-w-full h-full max-h-full">
      <div
        className="w-full max-w-full h-full max-h-full cursor-crosshair focus:outline-none"
        tabIndex={0}
        autoFocus={true}
        ref={containerRef}
      />

      {view.showOSAttribution && (
        <img
          className="absolute left-[8px] bottom-[8px]"
          width="90"
          height="24"
          src="/os-logo-maps.svg"
          alt="Ordnance Survey maps logo"
        />
      )}
    </div>
  );
}

function setGuess(
  marker: Feature,
  projection: Projection,
  guess: [number, number] | null,
) {
  if (guess) {
    const coords = proj4('EPSG:4326', projection.getCode(), guess);
    marker.setGeometry(new Point(coords));
  } else {
    marker.setGeometry(undefined);
  }
}

function setAnswer(
  marker: Feature,
  line: Feature,
  projection: Projection,
  target: [number, number],
  guess: [number, number],
) {
  const targetGeom = proj4('EPSG:4326', projection.getCode(), target);
  const guessGeom = proj4('EPSG:4326', projection.getCode(), guess);

  marker.setGeometry(new Point(targetGeom));

  line.setGeometry(new LineString([guessGeom, targetGeom]));
}

interface Bounds {
  centerX: number;
  centerY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  viewMinX: number;
  viewMinY: number;
  viewMaxX: number;
  viewMaxY: number;
}

function computeBounds(props: {
  target: [number, number];
  viewProjection: Projection;
  boundsMeters: number;
  boundsPaddingMeters?: number;
}): Bounds {
  const target = proj4(
    'EPSG:4326',
    props.viewProjection.getCode(),
    props.target,
  );

  const metersPerUnit = props.viewProjection.getMetersPerUnit();
  if (metersPerUnit === undefined) {
    throw new Error('expected projection to have meters per unit');
  }
  const boundsDelta = props.boundsMeters / metersPerUnit / 2;
  const boundsPadding =
    (props.boundsPaddingMeters ?? 0.05 * props.boundsMeters) / metersPerUnit;

  // by using a rng seeded with the target we ensure we offset consistently for each challenge
  const seed = Math.floor(target[0] * 10 ** 7 + target[1] * 10 ** 7);
  const pcg = new PcgRandom(seed);

  const offsetX = pcg.number() * boundsDelta * 2 - boundsDelta;
  const offsetY = pcg.number() * boundsDelta * 2 - boundsDelta;
  const centerX = target[0] + offsetX;
  const centerY = target[1] + offsetY;

  const minX = centerX - boundsDelta - boundsPadding;
  const minY = centerY - boundsDelta - boundsPadding;
  const maxX = centerX + boundsDelta + boundsPadding;
  const maxY = centerY + boundsDelta + boundsPadding;

  const viewMinX = centerX - (boundsDelta + boundsPadding) * 4;
  const viewMinY = centerY - (boundsDelta + boundsPadding) * 4;
  const viewMaxX = centerX + (boundsDelta + boundsPadding) * 4;
  const viewMaxY = centerY + (boundsDelta + boundsPadding) * 4;

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX,
    centerY,
    viewMinX,
    viewMinY,
    viewMaxX,
    viewMaxY,
  };
}

function boundsLayer(bounds: Bounds): VectorLayer {
  return new VectorLayer({
    source: new VectorSource({
      features: new OLGeoJSON().readFeatures(
        featureCollection([
          polygon([
            [
              [bounds.maxX, bounds.minY],
              [bounds.minX, bounds.minY],
              [bounds.minX, bounds.maxY],
              [bounds.maxX, bounds.maxY],
              [bounds.maxX, bounds.minY],
            ],
          ]),
        ]),
        {
          dataProjection: olProj27700,
        },
      ),
    }),
    style: (_f) =>
      new Style({
        stroke: new Stroke({
          color: '#387eff',
          lineDash: [12, 10],
          width: 4,
        }),
      }),
  });
}
