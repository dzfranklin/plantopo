import { SyncGeometry } from '@/gen/sync_schema';
import { bboxPolygonOf } from '../CurrentCamera';
import {
  EMPTY_SCENE,
  Scene,
  SceneFeature,
  SceneRootFeature,
} from '../engine/Scene';
import { FeatureRenderer } from './FeatureRenderer';

let subject: FeatureRenderer;
let idOffset: number;
beforeEach(() => {
  idOffset = 0;
  subject = new FeatureRenderer();
});

test('single point snapshot', () => {
  const got = subject.render(
    sceneFixture({
      features: {
        children: [
          {
            geometry: {
              type: 'Point',
              coordinates: [50, 50],
            },
          },
        ],
      },
    }),
    bboxPolygonOf(0, 0, 100, 100),
  );
  expect(got.list).toMatchSnapshot();
});

test('single line snapshot', () => {
  const got = subject.render(
    sceneFixture({
      features: {
        children: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [50, 50],
                [60, 60],
              ],
            },
          },
        ],
      },
    }),
    bboxPolygonOf(0, 0, 100, 100),
  );
  expect(got.list).toMatchSnapshot();
});

test('single active line snapshot', () => {
  const got = subject.render(
    sceneFixture({
      features: {
        children: [
          {
            active: true,
            geometry: {
              type: 'LineString',
              coordinates: [
                [50, 50],
                [60, 60],
              ],
            },
          },
        ],
      },
    }),
    bboxPolygonOf(0, 0, 100, 100),
  );
  expect(got.list).toMatchSnapshot();
});

describe('non-active renders do not handles', () => {
  const cases: SyncGeometry[] = [
    {
      type: 'Point',
      coordinates: [50, 50],
    },
    {
      type: 'LineString',
      coordinates: [
        [50, 50],
        [60, 60],
      ],
    },
  ];
  for (const c of cases) {
    test(`case ${c.type}`, () => {
      const gotNoActive = subject.render(
        sceneFixture({
          features: {
            children: [
              {
                geometry: c,
              },
            ],
          },
        }),
        bboxPolygonOf(0, 0, 100, 100),
      ).list;
      expect(gotNoActive.filter((f) => f.type === 'handle')).toHaveLength(0);

      const gotActive = subject.render(
        sceneFixture({
          features: {
            children: [
              {
                active: true,
                geometry: c,
              },
            ],
          },
        }),
        bboxPolygonOf(0, 0, 100, 100),
      ).list;
      expect(gotActive.filter((f) => f.type === 'handle')).not.toHaveLength(0);
    });
  }
});

function idFixture(): string {
  return `id${++idOffset}`;
}

interface SceneTemplate {
  features: RootFeatureTemplate;
}

type RootFeatureTemplate = { children: Array<FeatureTemplate> };

type FeatureTemplate = Partial<Omit<SceneFeature, 'parent'>>;

function sceneFixture(tmpl: SceneTemplate): Scene {
  const rootFeature: SceneRootFeature = { id: '', parent: null, children: [] };
  return {
    ...EMPTY_SCENE,
    features: {
      ...EMPTY_SCENE.features,
      root: {
        id: '',
        parent: null,
        children: tmpl.features.children.map((tmpl) =>
          sceneFixtureFeature(tmpl, rootFeature),
        ),
      },
    },
  };
}

function sceneFixtureFeature(
  tmpl: FeatureTemplate,
  parent: SceneRootFeature | SceneFeature,
): SceneFeature {
  const f = {
    parent,
    idx: '',
    children: [],
    hidden: false,

    active: false,
    selectedByMe: false,
    selectedByPeers: null,
    hoveredByMe: false,

    geometry: null,

    name: null,
    color: null,

    ...tmpl,

    id: tmpl.id ?? idFixture(),
  };
  if (tmpl.children) {
    f.children = tmpl.children.map((tmpl) => sceneFixtureFeature(tmpl, f));
  }
  return f;
}
