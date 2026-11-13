import { z } from "zod";

const serverEnvironmentSchema = z.object({
  ZEAOPS_API_INTERNAL_URL: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    }, "Use an HTTP(S) origin without credentials, a path, query, or fragment")
    .default("http://127.0.0.1:18301"),
});

export function getServerEnvironment() {
  return serverEnvironmentSchema.parse({
    ZEAOPS_API_INTERNAL_URL: process.env.ZEAOPS_API_INTERNAL_URL,
  });
}
