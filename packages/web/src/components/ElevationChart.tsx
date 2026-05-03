import { distance } from "@turf/distance";
import { useLayoutEffect, useMemo, useRef } from "react";

import type { Point2 } from "@pt/shared";

import { formatDistance, formatDuration, formatElevation } from "./format";
import { useUserPrefs } from "@/auth/auth-client";
import useResizeObserver from "@/hooks/useResizeObserver";
import logger from "@/logger";
import { cn } from "@/util/cn";

interface Props {
  points: Point2[];
  elevations: (number | null)[]; // in meters, same length as points
  timestamps?: (number | null)[]; // epoch ms, same length as points
  className?: string;
  onPointHover?: (point: Point2 | null) => void;
}

const dpr = window.devicePixelRatio || 1;

type UnscaleFn = (px: number, py: number) => { x: number; y: number };

export default function ElevationChart({
  points,
  elevations,
  timestamps,
  className,
  onPointHover,
}: Props) {
  const userPrefs = useUserPrefs();
  const sizerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const chartRef = useRef<{
    unscale: UnscaleFn;
    l: number;
    r: number;
    t: number;
    b: number;
  } | null>(null);

  const resizeEntry = useResizeObserver(sizerRef, { box: "content-box" });
  const ctxWidth = resizeEntry?.contentBoxSize[0]!.inlineSize;
  const ctxHeight = resizeEntry?.contentBoxSize[0]!.blockSize;

  const runningD = useMemo(() => computeRunningDistance(points), [points]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxWidth || !ctxHeight) return;

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = canvas.getContext("2d");
      if (!ctx) {
        logger.error("could not get canvas context");
        return;
      }
      ctxRef.current = ctx;
    }

    canvas.width = ctxWidth * dpr;
    canvas.height = ctxHeight * dpr;
    canvas.style.width = `${ctxWidth}px`;
    canvas.style.height = `${ctxHeight}px`;

    return () => {
      ctx.reset();
    };
  }, [ctxWidth, ctxHeight]);

  useLayoutEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !ctxWidth || !ctxHeight) return;

    if (
      runningD.length !== elevations.length ||
      (timestamps && runningD.length !== timestamps.length)
    ) {
      logger.error("input length mismatch");
      return;
    }

    ctx.reset();
    ctx.scale(dpr, dpr);

    const [minE, maxE] = rangeOf(elevations);
    const [_minD, maxD] = rangeOf(runningD);

    const yTicks = chooseYTicks({ minE, maxE }).map(value => ({
      value,
      label: formatElevation(value, userPrefs),
    }));
    const xTicks = chooseXTicks({ maxD }).map(value => ({
      value,
      label: formatDistance(value, userPrefs),
    }));

    // Set label font
    ctx.font = '11px "Noto Sans Variable", sans-serif';

    const { maxH: maxYLabelH, maxW: maxYLabelW } = measureLabels(ctx, yTicks);
    const { maxH: maxXLabelH, maxW: maxXLabelW } = measureLabels(ctx, xTicks);

    // Define chart placement

    const labelPad = 6; // Padding between labels and chart
    const headroom = 10; // It looks better with a bit of space above the highest point

    // Left/Right/Top/Bottom edges of chart area
    const chartL = maxYLabelW + labelPad + 1;
    const chartR = ctxWidth - (maxXLabelW / 2 + 1);
    const chartT = maxYLabelH / 2 + 1;
    const chartB = ctxHeight - (maxXLabelH + labelPad + 1);

    const maxX = Math.max(maxD, xTicks[xTicks.length - 1]!.value);
    const minY = Math.min(minE, yTicks[0]!.value);
    const maxY = Math.max(maxE, yTicks[yTicks.length - 1]!.value);

    const scaleX = (x: number) => chartL + (x / maxX) * (chartR - chartL);
    const scaleY = (y: number) =>
      chartB - ((y - minY) / (maxY - minY)) * (chartB - chartT - headroom);
    const unscale: UnscaleFn = (px, py) => {
      const x = ((px - chartL) / (chartR - chartL)) * maxX;
      const y =
        ((chartB - py) / (chartB - chartT - headroom)) * (maxY - minY) + minY;
      return { x, y };
    };

    chartRef.current = { unscale, l: chartL, r: chartR, t: chartT, b: chartB };

    // Draw chart

    ctx.fillStyle = "hsla(0, 0%, 80%)";
    ctx.beginPath();
    ctx.moveTo(chartL, chartB);
    let lastY = scaleY(0);
    for (let i = 0; i < runningD.length; i++) {
      // Elevation can be null, meaning missing, in which case we assume it's
      // the same as the previous point.
      const x = scaleX(runningD[i]!);
      const y = elevations[i] === null ? lastY : scaleY(elevations[i]!);
      ctx.lineTo(x, y);
      if (i === runningD.length - 1) ctx.lineTo(x, chartB);
      lastY = y;
    }
    ctx.closePath();
    ctx.fill();

    // Common styles for grid lines
    ctx.strokeStyle = "hsl(0, 0%, 90%)";
    ctx.globalCompositeOperation = "multiply";

    // Draw y grid lines
    for (let i = 0; i < yTicks.length; i++) {
      const { value } = yTicks[i]!;
      const y = scaleY(value);
      ctx.beginPath();
      ctx.moveTo(chartL, y);
      ctx.lineTo(chartR, y);
      ctx.stroke();
    }

    // Draw x grid lines
    for (let i = 0; i < xTicks.length; i++) {
      const { value } = xTicks[i]!;
      const x = scaleX(value);
      ctx.beginPath();
      ctx.moveTo(x, chartT);
      ctx.lineTo(x, chartB);
      ctx.stroke();
    }

    // Draw axes

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "hsl(0, 0%, 60%)";

    ctx.beginPath();
    ctx.moveTo(chartL, chartB + labelPad);
    ctx.lineTo(chartL, chartT);
    ctx.moveTo(chartL - labelPad, chartB);
    ctx.lineTo(chartR, chartB);
    ctx.stroke();

    // Draw y-axis labels
    ctx.fillStyle = "hsl(0, 0%, 45%)";
    ctx.textAlign = "right";
    for (const { value, label } of yTicks) {
      const y = scaleY(value);
      ctx.textBaseline = Math.abs(y - chartB) < 5 ? "bottom" : "middle";
      ctx.fillText(label, chartL - labelPad, y);
    }

    // Draw x-axis labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const { value, label } of xTicks) {
      const x = scaleX(value);
      ctx.fillText(label, x, chartB + labelPad);
    }

    return () => {
      ctx.clearRect(0, 0, ctxWidth, ctxHeight);
    };
  }, [elevations, timestamps, runningD, ctxWidth, ctxHeight, userPrefs]);

  const tooltipWidth = 80;
  const tooltipXMarkerWidth = 1.5;

  const onMouseMove = (e: React.MouseEvent) => {
    if (!chartRef.current || !tooltipRef.current || !sizerRef.current) return;
    const chart = chartRef.current;
    const tooltip = tooltipRef.current;

    const rect = sizerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    if (offsetX <= chart.l || offsetX >= chart.r) {
      tooltipRef.current.style.display = "none";
      onPointHover?.(null);
      return;
    }
    const { x } = chart.unscale(offsetX, offsetY);

    let closestIndex = 0;
    for (let i = 1; i < runningD.length; i++) {
      if (Math.abs(runningD[i]! - x) < Math.abs(runningD[closestIndex]! - x)) {
        closestIndex = i;
      }
    }

    const point = points[closestIndex]!;
    const elevation = elevations[closestIndex]!;
    const distance = runningD[closestIndex]!;

    let duration: number | null = null;
    let timestamp: number | null = null;
    if (timestamps) {
      const startT = timestamps[0]!;
      timestamp = timestamps[closestIndex]!;
      if (startT !== null && timestamp !== null) duration = timestamp - startT;
    }

    tooltip.style.display = "";
    tooltip.style.top = `${chart.t}px`;
    tooltip.style.height = `${chart.b - chart.t}px`;
    if (rect.width - offsetX > tooltipWidth * 1.2) {
      tooltip.style.left = `${offsetX - tooltipXMarkerWidth}px`;
      tooltip.style.right = "";
      tooltip.style.borderLeftWidth = `${tooltipXMarkerWidth}px`;
      tooltip.style.borderRightWidth = "0";
    } else {
      tooltip.style.left = "";
      tooltip.style.right = `${rect.width - offsetX}px`;
      tooltip.style.borderLeftWidth = "0";
      tooltip.style.borderRightWidth = `${tooltipXMarkerWidth}px`;
    }

    tooltip.querySelector('[data-slot="elevation"]')!.textContent = elevation
      ? formatElevation(elevation, userPrefs)
      : "No data";
    tooltip.querySelector('[data-slot="distance"]')!.textContent =
      formatDistance(distance, userPrefs, 2);
    if (timestamps) {
      tooltip.querySelector('[data-slot="duration"]')!.textContent = duration
        ? formatDuration(duration, "digital")
        : "No data";
    } else {
      tooltip.querySelector('[data-slot="duration"]')!.textContent = "";
    }

    onPointHover?.(point);
  };

  const onMouseLeave = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    onPointHover?.(null);
  };

  return (
    <div className={cn(className, "relative")}>
      <div
        className="absolute h-full w-full overflow-hidden"
        ref={sizerRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}>
        {resizeEntry && <canvas ref={canvasRef} />}
      </div>

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute flex flex-col border-[hsl(0,0%,50%)]"
        style={{ display: "none", width: `${tooltipWidth}px` }}>
        <div className="mx-2 mt-auto mb-2 flex flex-col rounded bg-white px-1 py-0.5 text-xs text-gray-800 shadow">
          <span data-slot="elevation" />
          <span data-slot="distance" />
          <span data-slot="duration" />
        </div>
      </div>
    </div>
  );
}

function chooseYTicks({
  minE,
  maxE,
}: {
  minE: number;
  maxE: number;
}): number[] {
  const idealCount = 5;

  const deltaE = Math.abs(maxE - minE);
  let requiredFactor: number;
  if (deltaE < 30) requiredFactor = 1;
  else if (deltaE < 300) requiredFactor = 20;
  else if (deltaE < 1000) requiredFactor = 100;
  else requiredFactor = 200;

  const step =
    Math.ceil(Math.abs(maxE - minE) / idealCount / requiredFactor) *
    requiredFactor;

  const firstTick =
    minE >= 0
      ? Math.max(Math.round(minE / step) * step, step)
      : Math.min(Math.round(minE / step) * step, -step);
  const lastTick = Math.round(maxE / step) * step;

  const ticks: number[] = [];
  for (let y = firstTick; y <= lastTick; y += step) ticks.push(y);
  if (ticks.length === 0) ticks.push(step);
  return ticks;
}

function chooseXTicks({ maxD }: { maxD: number }): number[] {
  const idealCount = 10;

  let requiredFactor: number;
  if (maxD <= 1000) requiredFactor = 100;
  else if (maxD <= 30_000) requiredFactor = 1000;
  else requiredFactor = 10_000;

  const step =
    Math.ceil(maxD / idealCount / requiredFactor) * requiredFactor ||
    requiredFactor;

  const ticks: number[] = [];
  for (let x = step; x < maxD; x += step) ticks.push(x);
  if (ticks.length === 0) ticks.push(step);
  return ticks;
}

function measureLabels(
  ctx: CanvasRenderingContext2D,
  ticks: { label: string }[],
): { maxH: number; maxW: number } {
  let maxHeight = 0;
  let maxWidth = 0;
  for (const { label } of ticks) {
    const mt = ctx.measureText(label);
    const labelHeight =
      mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
    const labelWidth = mt.width;
    if (labelHeight > maxHeight) maxHeight = labelHeight;
    if (labelWidth > maxWidth) maxWidth = labelWidth;
  }
  return { maxH: maxHeight, maxW: maxWidth };
}

function computeRunningDistance(points: Point2[]): number[] {
  const distances: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      total += distance(points[i - 1]!, points[i]!, { units: "meters" });
    }
    distances.push(total);
  }
  return distances;
}

function rangeOf(nums: (number | null)[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const n of nums) {
    if (n === null) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return [min, max];
}

export const exportedForTesting = {
  chooseXTicks,
  chooseYTicks,
};
