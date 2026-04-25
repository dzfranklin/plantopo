import { describe, expect, it } from "vitest";

import { exportedForTesting } from "./ElevationChart";

const { chooseXTicks, chooseYTicks } = exportedForTesting;

describe("yTicks", () => {
  const cases: Array<{
    label: string;
    minE: number;
    maxE: number;
    expected: number[];
  }> = [
    {
      label: "omits zero if minE nonnegative",
      minE: 0,
      maxE: 1_000,
      expected: [200, 400, 600, 800, 1_000],
    },
    {
      label: "uses interval of 200 if maxE is large",
      minE: 0,
      maxE: 1_000,
      expected: [200, 400, 600, 800, 1_000],
    },
    {
      label: "uses interval of 20 if maxE is small",
      minE: 0,
      maxE: 60,
      expected: [20, 40, 60],
    },
    {
      label: "uses interval of 20 if maxE is large but range is small",
      minE: 10_000,
      maxE: 10_060,
      expected: [10_000, 10_020, 10_040, 10_060],
    },
    {
      label: "includes tick past maxE if close",
      minE: 0,
      maxE: 950,
      expected: [200, 400, 600, 800, 1_000],
    },
    {
      label: "last tick is below maxE if next is not close",
      minE: 0,
      maxE: 850,
      expected: [200, 400, 600, 800],
    },
    {
      label: "always rounds up for first tick",
      minE: 1,
      maxE: 100,
      expected: [20, 40, 60, 80, 100],
    },
    {
      label: "includes at least one tick even if would round down",
      minE: 0,
      maxE: 1,
      expected: [1],
    },
    {
      label: "starts near minE",
      minE: 123,
      maxE: 1_000,
      expected: [200, 400, 600, 800, 1_000],
    },
    {
      label: "handles negative minE",
      minE: -500,
      maxE: 500,
      expected: [-400, -200, 0, 200, 400, 600],
    },
    {
      label: "handles negative maxE",
      minE: -1_000,
      maxE: -100,
      expected: [-1_000, -800, -600, -400, -200, 0],
    },
  ];
  for (const entry of cases) {
    const { expected, label, ...inputs } = entry;
    it(label, () => {
      const actual = chooseYTicks(inputs);
      expect(actual).toEqual(expected);
    });
  }
});

describe("xTicks", () => {
  const cases: Array<{
    label: string;
    maxD: number;
    expected: number[];
  }> = [
    {
      label: "uses interval of 2000 if maxD is large",
      maxD: 20_000,
      expected: [
        2_000, 4_000, 6_000, 8_000, 10_000, 12_000, 14_000, 16_000, 18_000,
      ],
    },
    {
      label: "uses interval of 100 if maxD is small",
      maxD: 600,
      expected: [100, 200, 300, 400, 500],
    },
  ];
  for (const entry of cases) {
    const { expected, label, ...inputs } = entry;
    it(label, () => {
      const actual = chooseXTicks(inputs);
      expect(actual).toEqual(expected);
    });
  }
});
