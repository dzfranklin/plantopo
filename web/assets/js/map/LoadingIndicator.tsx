import React, { useEffect, useRef } from "react";

export interface Props {
  isLoading: boolean;
}

export default function LoadingIndicator({ isLoading }: Props) {
  const nodeRef = useRef<HTMLCanvasElement>(null);
  const nextTick = useRef<number>();

  useEffect(() => {
    if (!isLoading) return;

    const totalSize = 18;
    const thickness = 2.7;
    const r = totalSize / 2 - thickness / 2;
    const perRot = 1000; // Millis per full rotation

    const canvas = nodeRef.current!;
    const ctx = canvas.getContext("2d")!;

    canvas.style.width = `${totalSize}px`;
    canvas.style.height = `${totalSize}px`;

    const scale = window.devicePixelRatio;
    canvas.width = Math.floor(totalSize * scale);
    canvas.height = Math.floor(totalSize * scale);
    ctx.scale(scale, scale);

    (window as any).ctx = ctx;
    (window as any).totalSize = totalSize;

    const startTime = Date.now();

    const update = () => {
      ctx.clearRect(0, 0, totalSize, totalSize);

      const t = (Date.now() - startTime) / perRot;
      const start = t * Math.PI * 2;
      const end = start + 1 + Math.PI / 4 + Math.sin((t - 0.25) * 2 * Math.PI);

      ctx.beginPath();
      ctx.strokeStyle = "#29d";
      ctx.lineCap = "round";
      ctx.lineWidth = thickness;
      ctx.arc(totalSize / 2, totalSize / 2, r, start, end);
      ctx.stroke();

      nextTick.current = requestAnimationFrame(update);
    };
    nextTick.current = requestAnimationFrame(update);

    return () => {
      const current = nextTick.current;
      if (current) {
        ctx.clearRect(0, 0, totalSize, totalSize);
        cancelAnimationFrame(current);
      }
    };
  }, [isLoading]);

  return (
    <canvas
      ref={nodeRef}
      className="fixed top-[5px] right-[5px] z-50 pointer-events-none"
    />
  );
}
