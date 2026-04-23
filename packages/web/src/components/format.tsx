import { useState } from "react";

import { useUserPrefs } from "@/auth/auth-client";

type DateLike = Date | string | number;

export function InstantView({
  date,
  className,
  variant = "auto",
}: {
  date: DateLike;
  className?: string;
  variant?: "date" | "datetime" | "time" | "relative" | "auto";
}) {
  const [now] = useState(() => new Date());
  const d = toDate(date);

  if (isNaN(d.getTime())) return null;

  let display: string;
  const fullDisplay = d.toLocaleString();
  if (variant === "date") {
    display = d.toLocaleDateString();
  } else if (variant === "datetime") {
    display = d.toLocaleString();
  } else if (variant === "time") {
    display = d.toLocaleTimeString();
  } else if (variant === "relative") {
    display = formatRelative(d, now);
  } else {
    display = formatAuto(d, now);
  }

  return (
    <time dateTime={d.toISOString()} className={className} title={fullDisplay}>
      {display}
    </time>
  );
}

export function DurationView(
  props: ({ ms: number } | { from: DateLike; to: DateLike }) & {
    className?: string;
  },
) {
  let ms: number;
  if ("ms" in props) {
    ms = props.ms;
  } else {
    const from = toDate(props.from);
    const to = toDate(props.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
    ms = to.getTime() - from.getTime();
  }
  const { className } = props;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));

  const display = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    `${seconds}s`,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={className}>{display}</span>;
}

function toDate(date: DateLike) {
  return typeof date === "object" ? date : new Date(date);
}

function formatRelative(date: Date, now: Date = new Date()) {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return `${pluralize(diffSec, "second")} ago`;
  } else if (diffMin < 60) {
    return `${pluralize(diffMin, "minute")} ago`;
  } else if (diffHr < 24) {
    return `${pluralize(diffHr, "hour")} ago`;
  } else {
    return `${pluralize(diffDay, "day")} ago`;
  }
}

function formatAuto(date: Date, now: Date = new Date()) {
  const diffMs = now.getTime() - date.getTime();
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDay >= 7) {
    return date.toLocaleDateString();
  } else {
    return formatRelative(date);
  }
}

function pluralize(count: number, singular: string, plural?: string) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural ?? singular + "s"}`;
}

export function DistanceView({ m }: { m: number }) {
  const { distanceUnit } = useUserPrefs();
  let display: string;
  if (distanceUnit === "mi") {
    display = `${(m * 0.000621371).toFixed(2)} mi`;
  } else {
    display = `${(m / 1000).toFixed(2)} km`;
  }
  return <span>{display}</span>;
}
