jest.mock('../../engine/EditorEngine');
jest.mock('../../CurrentCamera');

import { InteractionManager } from './InteractionManager';
import { CurrentCameraPosition } from '../../CurrentCamera';
import { RenderFeature } from '../FeatureRenderer';
import { add2 } from '@/generic/vector2';
import { EditorEngine } from '../../engine/EditorEngine';
import { EMPTY_SCENE, SceneFeature } from '../../engine/Scene';

const mockEngine = EditorEngine as jest.Mock<EditorEngine>;
const mockCamera =
  CurrentCameraPosition as any as jest.Mock<CurrentCameraPosition>;
const mockMap = jest.fn();

class ResizeObserver {
  constructor(public cb: any) {}
  observe(..._args: unknown[]) {}
  unobserve(..._args: unknown[]) {}
  disconnect() {}
}

let camera: CurrentCameraPosition;
let subject: InteractionManager;
let container: HTMLDivElement;
let engine: EditorEngine;

let nextFid = 1;
const makeFeature = (props: Partial<RenderFeature> = {}): RenderFeature => ({
  ...props,
  id: `fake-${nextFid++}`,
  children: [],
  active: false,
  selectedByMe: false,
  selectedByPeers: null,
  hoveredByMe: false,
  geometry: {
    type: 'Point',
    coordinates: [0, 0],
  },
  name: 'Some Name',
  color: '#000000',
});

beforeEach(() => {
  nextFid = 1;

  window.ResizeObserver = ResizeObserver;

  container = document.createElement('div');
  container.innerHTML = `<div class="maplibregl-canvas-container maplibregl-interactive"></div>`;

  mockCamera.mockClear();
  camera = new mockCamera();

  mockEngine.mockClear();
  engine = new mockEngine();
  engine.getFeature = jest.fn((id) => {
    return { id } as SceneFeature;
  });
  (engine as any).scene = EMPTY_SCENE;

  mockMap.mockClear();

  subject = new InteractionManager({
    engine,
    initialCamera: camera,
    container,
    map: mockMap(),
  });
});

describe('queryHits', () => {
  it('finds exact match', () => {
    subject.register(
      [
        makeFeature({
          id: 'fake-1',
          geometry: { type: 'Point', coordinates: [0, 0] },
        }),
      ],
      camera,
    );

    camera.unproject = jest.fn((screen) => {
      expect(screen).toEqual(add2([100, 100], subject.querySlop));
      return [0.1, 0.1];
    });

    const actual = subject.queryHits([100, 100], [0, 0]);

    expect(camera.unproject).toHaveBeenCalledTimes(1);
    expect(actual).toHaveLength(1);
    expect(actual[0]!.id).toBe('fake-1');
  });
});
