import { DateTime } from 'luxon';
import { z } from 'zod';

export const zDateTime = z
  .string()
  .datetime()
  .transform((val, ctx) => {
    const parsed = DateTime.fromISO(val);
    if (!parsed.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${parsed.invalidReason}: ${parsed.invalidExplanation}`,
      });
      return z.NEVER;
    }
    return parsed;
  });

export const zDate = z
  .string()
  .date()
  .transform((val, ctx) => {
    const parsed = DateTime.fromISO(val);
    if (!parsed.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${parsed.invalidReason}: ${parsed.invalidExplanation}`,
      });
      return z.NEVER;
    }
    return parsed;
  });
