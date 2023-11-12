import { FeatureActionHandler } from './FeatureActionHandler';

let subject: FeatureActionHandler;
beforeEach(() => {
  subject = new FeatureActionHandler();
});

describe('onHover', () => {
  it('sets the cursor to pointer when hovering over a feature', () => {
    const evt = {
      queryHits: () => [
        {
          item: { id: 'foo' },
          minPixelsTo: () => 0.1,
        },
      ],
    } as any;
    const engine = { setHovered: jest.fn() } as any;
    subject.onHover(evt, engine);
    expect(engine.setHovered).toHaveBeenCalledWith('foo');
    expect(subject.cursor).toEqual('pointer');
  });

  it('sets the cursor to undefined when not hovering over a feature', () => {
    const evt = {
      queryHits: () => [
        {
          item: { id: 'foo' },
          minPixelsTo: () => 0.6,
        },
      ],
    } as any;
    const engine = { setHovered: jest.fn() } as any;
    subject.onHover(evt, engine);
    expect(engine.setHovered).toHaveBeenCalledWith(null);
    expect(subject.cursor).toEqual(undefined);
  });
});

describe('onPress', () => {
  it('toggles the selection of a feature when activeTool=select', () => {
    const evt = {
      shiftKey: false,
      unproject: () => [1, 2],
      queryHits: () => [
        {
          item: { id: 'foo' },
          minPixelsTo: () => 0.1,
        },
      ],
    } as any;
    const engine = {
      toggleSelection: jest.fn(),
      scene: {
        activeTool: 'select',
        activeFeature: {
          id: 'foo',
          geometry: { type: 'LineString', coordinates: [[0, 0]] },
        },
      },
    } as any;
    subject.onPress(evt, engine);
    expect(engine.toggleSelection).toHaveBeenCalledWith('foo', 'single');
  });

  describe('where activeTool=line', () => {
    it('appends a run of points to the empty active feature', () => {
      // INITIAL PRESS

      const evt1 = {
        unproject: () => [1, 2],
      } as any;
      const engine1 = {
        scene: {
          activeTool: 'line',
          activeFeature: {
            id: 'foo',
            geometry: { type: 'LineString', coordinates: [[0, 0]] },
          },
        },
        changeFeature: jest.fn(),
      } as any;

      subject.onPress(evt1, engine1);
      expect(engine1.changeFeature).toHaveBeenCalledWith({
        id: 'foo',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 2],
          ],
        },
      });

      // FIRST SUBSEQUENT PRESS

      const evt2 = {
        unproject: () => [3, 4],
      } as any;
      const engine2 = {
        scene: {
          activeTool: 'line',
          activeFeature: {
            id: 'foo',
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 2],
              ],
            },
          },
        },
        changeFeature: jest.fn(),
      } as any;

      subject.onPress(evt2, engine2);
      expect(engine2.changeFeature).toHaveBeenCalledWith({
        id: 'foo',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 2],
            [3, 4],
          ],
        },
      });

      // SECOND SUBSEQUENT PRESS

      const evt3 = {
        unproject: () => [5, 6],
      } as any;

      const engine3 = {
        scene: {
          activeTool: 'line',
          activeFeature: {
            id: 'foo',
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 2],
                [3, 4],
              ],
            },
          },
        },
        changeFeature: jest.fn(),
      } as any;

      subject.onPress(evt3, engine3);
      expect(engine3.changeFeature).toHaveBeenCalledWith({
        id: 'foo',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 2],
            [3, 4],
            [5, 6],
          ],
        },
      });
    });

    it('does not append a run of points to the non-empty active feature', () => {
      const evt1 = {
        unproject: () => [1, 2],
        queryHits: () => [],
      } as any;
      const engine1 = {
        scene: {
          activeTool: 'line',
          activeFeature: {
            id: 'foo',
            geometry: {
              type: 'LineString',
              coordinates: [
                [1, 1],
                [1, 2],
              ],
            },
          },
        },
        changeFeature: jest.fn(),
      } as any;

      subject.onPress(evt1, engine1);
      expect(engine1.changeFeature).not.toHaveBeenCalled();
    });
  });
});

it('updates the geometry of the dragged point', () => {
  const evt = {
    unproject: () => [1, 2],
    queryHits: () => [
      {
        item: {
          type: 'handle',
          id: 'foo-handle',
          feature: {
            id: 'foo',
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
          handleType: 'point',
          i: 0,
        },
        minPixelsTo: () => 0.1,
      },
    ],
  } as any;
  const engine = {
    changeFeature: jest.fn(),
  } as any;
  subject.onDragStart(evt, engine);
  expect(engine.changeFeature).toHaveBeenCalledWith({
    id: 'foo',
    geometry: {
      type: 'Point',
      coordinates: [1, 2],
    },
  });
});

describe('drag vertex', () => {
  const subject = new FeatureActionHandler();

  it('on drag start', () => {
    const evt = {
      unproject: () => [1, 2],
      queryHits: () => [
        {
          item: {
            type: 'handle',
            id: 'foo-handle',
            feature: {
              id: 'foo',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [0, 0],
                  [1, 1],
                ],
              },
            },
            handleType: 'point',
            i: 1,
          },
          minPixelsTo: () => 0.1,
        },
      ],
    } as any;
    const engine = {
      changeFeature: jest.fn(),
    } as any;

    subject.onDragStart(evt, engine);

    expect(engine.changeFeature).toHaveBeenCalledWith({
      id: 'foo',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 2],
        ],
      },
    });
  });

  it('on drag', () => {
    const evt = {
      unproject: () => [1, 2],
    } as any;
    const engine = {
      getFeature: () => ({
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      }),
      changeFeature: jest.fn(),
    } as any;

    subject.onDrag(evt, [0, 0], engine);

    expect(engine.changeFeature).toHaveBeenCalledWith({
      id: 'foo',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 2],
        ],
      },
    });
  });

  it('on drag end', () => {
    const evt = {
      unproject: () => [1, 2],
    } as any;
    const engine = {
      getFeature: () => ({
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      }),
      changeFeature: jest.fn(),
    } as any;

    subject.onDragEnd(evt, engine);

    expect(engine.changeFeature).toHaveBeenCalledWith({
      id: 'foo',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 2],
        ],
      },
    });
  });
});

describe('drag midpoint', () => {
  const subject = new FeatureActionHandler();

  it('on drag start', () => {
    const evt = {
      unproject: () => [1, 2],
      queryHits: () => [
        {
          item: {
            type: 'handle',
            id: 'foo-handle',
            feature: {
              id: 'foo',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [0, 0],
                  [2, 2],
                ],
              },
            },
            handleType: 'midpoint',
            i: 0,
          },
          minPixelsTo: () => 0.1,
        },
      ],
    } as any;
    const engine = {
      changeFeature: jest.fn(),
    } as any;

    subject.onDragStart(evt, engine);

    expect(engine.changeFeature).toHaveBeenCalledWith({
      id: 'foo',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 2],
          [2, 2],
        ],
      },
    });
  });

  it('on drag', () => {
    const evt = {
      unproject: () => [3, 3],
    } as any;
    const engine = {
      getFeature: () => ({
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 2],
            [2, 2],
          ],
        },
      }),
      changeFeature: jest.fn(),
    } as any;

    subject.onDrag(evt, [0, 0], engine);

    expect(engine.changeFeature).toHaveBeenCalledWith({
      id: 'foo',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [3, 3],
          [2, 2],
        ],
      },
    });
  });
});
