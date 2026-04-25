/* eslint-disable react-refresh/only-export-components */
import { useUserPrefs } from "@/auth/auth-client";
import logger from "@/logger";

// Only use English locales for consistency with the rest of the UI
const locale = navigator.languages.find(l => l.startsWith("en")) || "en";

type DateInput = Date | string | number;

const dateNoYearStyle: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
};
const dateWithYearStyle: Intl.DateTimeFormatOptions = {
  ...dateNoYearStyle,
  year: "numeric",
};
const timeStyle: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "numeric",
};
const relativeDatetimeStyle: Intl.RelativeTimeFormatOptions = {
  numeric: "auto",
};

const dateFmtNoYear = new Intl.DateTimeFormat(locale, dateNoYearStyle);
const dateWithYearFmt = new Intl.DateTimeFormat(locale, dateWithYearStyle);
const timeFmt = new Intl.DateTimeFormat(locale, timeStyle);
const datetimeNoYearFmt = new Intl.DateTimeFormat(locale, {
  ...dateNoYearStyle,
  ...timeStyle,
});
const dateTimeWithYearFmt = new Intl.DateTimeFormat(locale, {
  ...dateWithYearStyle,
  ...timeStyle,
});
const relativeDatetimeFmt = new Intl.RelativeTimeFormat(
  locale,
  relativeDatetimeStyle,
);

function shouldDisplayYear(date: Date) {
  // show year if more than ~10 months difference
  const maxDeltaMs = 1000 * 60 * 60 * 24 * 300;
  return Math.abs(Date.now() - date.getTime()) < maxDeltaMs;
}

function shouldDisplayRelative(date: Date) {
  // show relative for dates within ~15 days
  const maxDeltaMs = 1000 * 60 * 60 * 24 * 15;
  return Math.abs(Date.now() - date.getTime()) < maxDeltaMs;
}

function toDate(date: DateInput) {
  return typeof date === "object" ? date : new Date(date);
}

export type InstantVariant = "date" | "datetime" | "time" | "relative";

export function formatInstant(
  date: DateInput,
  variant: InstantVariant = "relative",
): string {
  const d = toDate(date);
  if (isNaN(d.getTime())) return String(date);
  switch (variant) {
    case "date":
      return fmtDate(d);
    case "datetime":
      return fmtDatetime(d);
    case "time":
      return timeFmt.format(d);
    case "relative":
      return formatRelativeDatetime(d);
  }
}

const fmtDate = (d: Date) =>
  shouldDisplayYear(d) ? dateFmtNoYear.format(d) : dateWithYearFmt.format(d);

const fmtDatetime = (d: Date) =>
  shouldDisplayYear(d)
    ? datetimeNoYearFmt.format(d)
    : dateTimeWithYearFmt.format(d);

function formatRelativeDatetime(date: Date): string {
  if (!shouldDisplayRelative(date)) return fmtDate(date);

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (Math.abs(diffSec) < 60) {
    return relativeDatetimeFmt.format(0, "second"); // show "now"
  } else if (Math.abs(diffMin) < 60) {
    return relativeDatetimeFmt.format(-diffMin, "minute");
  } else if (Math.abs(diffHr) < 24) {
    return relativeDatetimeFmt.format(-diffHr, "hour");
  } else {
    return (
      relativeDatetimeFmt.format(-diffDay, "day") +
      " at " +
      timeFmt.format(date)
    );
  }
}

export function InstantView({
  date,
  variant,
  ...forwardedProps
}: {
  date: DateInput;
  variant?: InstantVariant;
} & Omit<React.ComponentPropsWithoutRef<"time">, "dateTime" | "children">) {
  const d = toDate(date);
  return (
    <time
      dateTime={d.toISOString()}
      title={dateTimeWithYearFmt.format(d)}
      {...forwardedProps}>
      {formatInstant(d, variant)}
    </time>
  );
}

const fallbackDurationFmt: Pick<Intl.DurationFormat, "format"> = {
  format(d): string {
    const unitOrder = [
      "years",
      "months",
      "weeks",
      "days",
      "hours",
      "minutes",
    ] as const;
    return unitOrder
      .map(unit => (d[unit] ? `${d[unit]} ${unit}` : null))
      .filter(Boolean)
      .join(" ");
  },
};

if (!Intl.DurationFormat) {
  logger.warn("Intl.DurationFormat not supported, using fallback");
}

// style: short gives e.g. "3 hrs, 2 mins". "narrow" ("3h 2m") isn't suitable
// because it conflics with how we display metres ("3m")
const shortDurationFmt = Intl.DurationFormat
  ? new Intl.DurationFormat(locale, { style: "short" })
  : fallbackDurationFmt;

const digitalDurationFmt = Intl.DurationFormat
  ? new Intl.DurationFormat(locale, { style: "digital" })
  : fallbackDurationFmt;

type Duration = Partial<Record<Intl.DurationFormatUnit, number>>;
type DurationInput = Duration | number;

function toDuration(d: DurationInput): Duration {
  if (typeof d === "number") {
    // interpret as ms
    const seconds = Math.floor(d / 1000) % 60;
    const minutes = Math.floor(d / (1000 * 60)) % 60;
    const hours = Math.floor(d / (1000 * 60 * 60)) % 24;
    const days = Math.floor(d / (1000 * 60 * 60 * 24)) % 7;
    const weeks = Math.floor(d / (1000 * 60 * 60 * 24 * 7)) % 4;
    const months = Math.floor(d / (1000 * 60 * 60 * 24 * 30)) % 12;
    const years = Math.floor(d / (1000 * 60 * 60 * 24 * 365));
    return { years, months, weeks, days, hours, minutes, seconds };
  } else {
    return d;
  }
}

type DurationVariant = "short" | "digital";

export function formatDuration(
  ms: number,
  variant: DurationVariant = "short",
): string {
  const d = toDuration(ms);
  switch (variant) {
    case "short": {
      const order: Intl.DurationFormatUnit[] = [
        "years",
        "months",
        "weeks",
        "days",
        "hours",
        "minutes",
      ];

      const highestUnitI = order.findIndex(unit => d[unit]);
      if (highestUnitI === -1) return "0 mins";

      const displayOrder = order.slice(
        highestUnitI,
        Math.min(highestUnitI + 3, order.length),
      );
      const displayDuration: Duration = {};
      for (const unit of displayOrder) {
        if (d[unit]) displayDuration[unit] = d[unit];
      }

      return shortDurationFmt.format(displayDuration);
    }
    case "digital":
      return digitalDurationFmt.format({
        hours: d.hours ?? 0,
        minutes: d.minutes ?? 0,
        seconds: d.seconds ?? 0,
      });
  }
}

export function DurationView({
  variant,
  ...props
}: ({ ms: number } | { from: DateInput; to: DateInput }) & {
  variant?: DurationVariant;
} & Omit<React.ComponentPropsWithoutRef<"span">, "children">) {
  let ms: number;
  let forwardedProps: React.ComponentPropsWithoutRef<"span">;
  if ("ms" in props) {
    const { ms: msProp, ...rest } = props;
    ms = msProp;
    forwardedProps = rest;
  } else {
    const { from: fromProp, to: toProp, ...rest } = props;
    const from = toDate(fromProp);
    const to = toDate(toProp);
    forwardedProps = rest;
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
    ms = to.getTime() - from.getTime();
  }

  return <span {...forwardedProps}>{formatDuration(ms, variant)}</span>;
}

const FEET_IN_METER = 3.28084;
const MILE_IN_METER = 0.000621371;

const distanceFormatterMetric1 = newUnitFormatter("kilometer", {
  maximumFractionDigits: 1,
});
const distanceFormatterMetric2 = newUnitFormatter("kilometer", {
  maximumFractionDigits: 2,
});
const distanceFormatterImperial1 = newUnitFormatter("mile", {
  maximumFractionDigits: 1,
});
const distanceFormatterImperial2 = newUnitFormatter("mile", {
  maximumFractionDigits: 2,
});

type DistanceFractionDigits = 1 | 2;

export function formatDistance(
  m: number,
  prefs: { distanceUnit: "km" | "mi" },
  maxFractionDigits: DistanceFractionDigits = 1,
): string {
  if (prefs.distanceUnit === "mi") {
    switch (maxFractionDigits) {
      case 1:
        return distanceFormatterImperial1.format(m * MILE_IN_METER);
      case 2:
        return distanceFormatterImperial2.format(m * MILE_IN_METER);
    }
  } else {
    switch (maxFractionDigits) {
      case 1:
        return distanceFormatterMetric1.format(m / 1000);
      case 2:
        return distanceFormatterMetric2.format(m / 1000);
    }
  }
}

export function DistanceView({
  m,
  maxFractionDigits,
  ...forwardedProps
}: { m: number; maxFractionDigits?: DistanceFractionDigits } & Omit<
  React.ComponentPropsWithoutRef<"span">,
  "children"
>) {
  const prefs = useUserPrefs();
  return (
    <span {...forwardedProps}>
      {formatDistance(m, prefs, maxFractionDigits)}
    </span>
  );
}

const elevationFormatterMetric = newUnitFormatter("meter", {
  maximumFractionDigits: 0,
});
const elevationFormatterImperial = newUnitFormatter("foot", {
  maximumFractionDigits: 0,
});

export function formatElevation(
  m: number,
  prefs: { distanceUnit: "km" | "mi" },
): string {
  if (prefs.distanceUnit === "mi") {
    return elevationFormatterImperial.format(m * FEET_IN_METER);
  } else {
    return elevationFormatterMetric.format(m);
  }
}

export function ElevationView({
  m,
  ...forwardedProps
}: { m: number } & Omit<React.ComponentPropsWithoutRef<"span">, "children">) {
  const prefs = useUserPrefs();
  return <span {...forwardedProps}>{formatElevation(m, prefs)}</span>;
}

function newUnitFormatter(
  unit: string,
  opts?: Omit<Intl.NumberFormatOptions, "style" | "unit">,
) {
  if (Intl.supportedValuesOf("unit").includes(unit)) {
    return new Intl.NumberFormat(locale, { style: "unit", unit, ...opts });
  } else {
    logger.warn(
      `Unit "${unit}" not supported in Intl.NumberFormat, using fallback`,
    );
    return new Intl.NumberFormat(locale);
  }
}
