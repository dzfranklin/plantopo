import { distance } from "@turf/distance";
import { useLayoutEffect, useMemo, useRef } from "react";

import type { Point } from "@pt/shared";

import { formatDistance, formatElevation } from "./format";
import { useUserPrefs } from "@/auth/auth-client";
import useResizeObserver from "@/hooks/useResizeObserver";
import logger from "@/logger";

interface Props {
  points: Point[];
  elevations: (number | null)[]; // in meters, same length as points
  timestamps?: (number | null)[]; // epoch ms, same length as points
  className?: string;
}

const dpr = window.devicePixelRatio || 1;

export default function ElevationChart({
  points,
  elevations,
  timestamps,
  className,
}: Props) {
  const userPrefs = useUserPrefs();
  const divRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const resizeEntry = useResizeObserver(divRef, { box: "content-box" });
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
    const chartT = maxYLabelH / 2 + headroom + 1;
    const chartB = ctxHeight - (maxXLabelH + labelPad + 1);

    const maxX = Math.max(maxD, xTicks[xTicks.length - 1]!.value);
    const minY = Math.min(minE, yTicks[0]!.value);
    const maxY = Math.max(maxE, yTicks[yTicks.length - 1]!.value);

    const scaleX = (x: number) => chartL + (x / maxX) * (chartR - chartL);
    const scaleY = (y: number) =>
      chartB - ((y - minY) / (maxY - minY)) * (chartB - chartT);

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
      ctx.moveTo(x, chartT - headroom);
      ctx.lineTo(x, chartB);
      ctx.stroke();
    }

    // Draw axes

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "hsl(0, 0%, 60%)";

    ctx.beginPath();
    ctx.moveTo(chartL, chartB + labelPad);
    ctx.lineTo(chartL, chartT - headroom);
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

  return (
    <div
      ref={divRef}
      style={{ overflow: "hidden" }} // Required by resize implementation
      className={className}>
      {resizeEntry && <canvas ref={canvasRef} />}
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

function computeRunningDistance(points: Point[]): number[] {
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
