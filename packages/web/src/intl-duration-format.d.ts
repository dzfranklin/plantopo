// Intl.DurationFormat is Baseline 2025
// This is a temporary subset of the PR adding ES2025 to TypeScript.
// See <https://github.com/petamoriken/TypeScript/blob/2fcf0f860646d0f4de805a3518bc313851d637a3/src/lib/es2025.intl.d.ts#L30>

declare namespace Intl {
  type DurationFormatUnit =
    | "years"
    | "months"
    | "weeks"
    | "days"
    | "hours"
    | "minutes"
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds";

  interface DurationFormat {
    format(duration: Partial<Record<DurationFormatUnit, number>>): string;
  }

  /**
   * [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat/DurationFormat#options)
   *
   * (missing many options)
   */
  interface DurationFormatOptions {
    style: "long" | "short" | "narrow" | "digital";
  }

  /** [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat/DurationFormat) */
  const DurationFormat:
    | {
        prototype: DurationFormat;
        new (
          locales?: string | string[],
          options?: DurationFormatOptions,
        ): DurationFormat;
      }
    | undefined;
}
