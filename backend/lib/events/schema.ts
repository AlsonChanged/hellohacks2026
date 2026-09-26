import { z } from "zod";

export const extractedEventSchema = z.object({
  name: z.string().min(1),
  price_label: z.string().nullable(),
  price_cents: z.number().int().nonnegative().nullable(),
  is_free: z.boolean(),
  starts_at: z.string().datetime({ offset: true }).nullable(),
  ends_at: z.string().datetime({ offset: true }).nullable(),
  location: z.string().nullable(),
  club: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()).max(12),
  free_food: z.boolean(),
  is_event: z.boolean(),
});

export type ExtractedEvent = z.infer<typeof extractedEventSchema>;

export const ingestItemSchema = z.object({
  instagramUrl: z.string().url(),
  caption: z.string().min(1),
  clubName: z.string().min(1),
  clubHandle: z.string().min(1),
  externalId: z.string().min(1).optional(),
  postedAt: z.string().datetime({ offset: true }).optional(),
  mediaUrl: z.string().url().optional(),
  followerCount: z.number().int().nonnegative().optional(),
  sourceId: z.string().uuid().optional(),
});

