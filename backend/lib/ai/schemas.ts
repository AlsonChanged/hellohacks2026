import { z } from "zod";

// Dates come back as parts, not ISO strings, so the model never has to invent
// a year or a UTC offset. lib/events/normalize.ts turns the parts into instants
// with a deterministic, documented rule.
const localDateTimeSchema = z.object({
  /** null when the post does not state the year. */
  year: z.number().int().min(2000).max(2100).nullable(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  /** 24h "HH:MM" local time, or null when no time is given. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
});

export type LocalDateTime = z.infer<typeof localDateTimeSchema>;

export const aiEventSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  start: localDateTimeSchema.nullable(),
  end: localDateTimeSchema.nullable(),
  /** IANA zone only when the post names one (e.g. "PST" -> America/Vancouver). */
  timezone: z.string().nullable(),
  location: z.string().nullable(),
  registration_url: z.string().nullable(),
  organization: z.string().nullable(),
  price_label: z.string().nullable(),
  is_free: z.boolean().nullable(),
  free_food: z.boolean(),
  tags: z.array(z.string()).max(12),
});

export const aiEventExtractionSchema = z
  .object({
    is_event: z.boolean(),
    event: aiEventSchema.nullable(),
    /** Model-reported signal, not a calibrated probability. */
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  })
  .refine((r) => (r.is_event ? r.event !== null : r.event === null), {
    message: "event must be present exactly when is_event is true",
    path: ["event"],
  });

export type AIEvent = z.infer<typeof aiEventSchema>;
export type AIEventExtraction = z.infer<typeof aiEventExtractionSchema>;
