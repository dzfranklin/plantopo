import { beforeEach, describe, expect, test } from 'vitest';
import { GraphInputFeature, SnapGraph } from '@/features/map/snap/SnapGraph';
import { lineString } from '@turf/helpers';

let nextID = 1;
beforeEach(() => {
  nextID = 1;
});

describe('load', () => {
  test('lines in x', () => {
    const subject = new SnapGraph([
      feature([
        [0, 1],
        [1, 1],
        [2, 1],
      ]),
      feature([
        [1, 2],
        [1, 1],
        [1, 0],
      ]),
    ]);

    expectNodePoints(
      subject,
      `
  "1/1": 0 1, 1 1
  "1/2": 1 1, 2 1
  "2/1": 1 2, 1 1
  "2/2": 1 1, 1 0
  `,
    );

    expectLinks(
      subject,
      `
  "1/1" -- "1/2";
  "1/1" -- "2/1";
  "1/1" -- "2/2";
  "1/2" -- "2/1";
  "1/2" -- "2/2";
  "2/1" -- "2/2";
  `,
    );
  });

  test('lines in sequence', () => {
    const subject = new SnapGraph([
      feature([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
      feature([
        [2, 0],
        [3, 0],
        [4, 0],
      ]),
    ]);

    expectNodePoints(
      subject,
      `
  "1": 0 0, 1 0, 2 0
  "2": 2 0, 3 0, 4 0
  `,
    );

    expectLinks(
      subject,
      `
  "1" -- "2";
  `,
    );
  });

  test('lines overlapping entirely', () => {
    const subject = new SnapGraph([
      feature([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
      feature([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ]);

    expectNodePoints(
      subject,
      `
  "1/1": 0 0, 1 0
  "1/2": 1 0, 2 0
  "2/1": 0 0, 1 0
  "2/2": 1 0, 2 0
  `,
    );

    expectLinks(
      subject,
      `
  "1/1" -- "1/2";
  "1/1" -- "2/1";
  "1/1" -- "2/2";
  "1/2" -- "2/1";
  "1/2" -- "2/2";
  "2/1" -- "2/2";
  `,
    );
  });

  test('lines overlapping partially', () => {
    const subject = new SnapGraph([
      feature([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
      feature([
        [1, 0],
        [2, 0],
      ]),
    ]);

    expectNodePoints(
      subject,
      `
  "1/1": 0 0, 1 0
  "1/2": 1 0, 2 0
  "2": 1 0, 2 0
  `,
    );

    expectLinks(
      subject,
      `
  "1/1" -- "1/2";
  "1/1" -- "2";
  "1/2" -- "2";
  `,
    );
  });
});

describe('search', () => {
  test('between endpoints of node', () => {
    const subject = new SnapGraph([
      feature([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ]);

    expectSearch(
      subject,
      [0, 0],
      [2, 0],
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    );
  });

  test('between intermediate points of node', () => {
    const subject = new SnapGraph([
      feature([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ]),
    ]);

    expectSearch(
      subject,
      [1, 0],
      [3, 0],
      [
        [1, 0],
        [2, 0],
        [3, 0],
      ],
    );
  });

  test('between identical points', () => {
    const subject = new SnapGraph([
      feature([
        [0, 0],
        [1, 0],
      ]),
    ]);

    expectSearch(subject, [0, 0], [0, 0], null);
  });
});

function expectSearch(
  subject: SnapGraph,
  from: [number, number],
  to: [number, number],
  expected: Array<[number, number]> | null,
) {
  if (expected === null) {
    expect(subject.search(from, to)).toBeNull();
  } else {
    expect(subject.search(from, to)).toEqual({
      type: 'LineString',
      coordinates: expected,
    });
  }
}

function expectNodePoints(subject: SnapGraph, expected: string) {
  expect(normalizeLines(subject.dumpNodePoints())).toStrictEqual(
    normalizeLines(expected),
  );
}

function expectLinks(subject: SnapGraph, expected: string) {
  expect(normalizeLines(subject.dumpLinks())).toStrictEqual(
    normalizeLines(expected),
  );
}

function normalizeLines(v: string): string {
  return v
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .sort()
    .join('\n');
}

function feature(
  f?:
    | Partial<
        Omit<GraphInputFeature, 'id'> & { id: string | number | undefined }
      >
    | Array<[number, number]>,
): GraphInputFeature {
  if (Array.isArray(f) && f !== null) {
    return feature(lineString(f));
  }

  const geometry = f?.geometry ?? {
    type: 'LineString',
    coordinates: [
      [1, 1],
      [2, 3],
    ],
  };
  return {
    ...f,
    id: (f?.id ?? nextID++).toString(),
    type: f?.type ?? 'Feature',
    geometry: f?.geometry ?? geometry,
    properties: f?.properties ?? {},
  };
}
