import { z } from "zod";

export const healthSchema = z.object({
  status: z.enum(["ok", "ready"]),
  service: z.literal("zeaops-api"),
});
export type Health = z.infer<typeof healthSchema>;
export const liveHealthSchema = healthSchema.extend({ status: z.literal("ok") });
export const readyHealthSchema = healthSchema.extend({ status: z.literal("ready") });

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), correlation_id: z.string() }),
});

export const refreshPreferenceSchema = z.object({
  interval: z.enum(["15", "30", "60"]),
});
export type RefreshPreference = z.infer<typeof refreshPreferenceSchema>;
