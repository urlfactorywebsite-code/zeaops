import { describe, expect, it } from "vitest";
import { healthSchema, refreshPreferenceSchema } from "./index";

describe("health contracts", () => {
  it("accepts the API response", () => {
    expect(healthSchema.parse({ status: "ready", service: "zeaops-api" }).status).toBe("ready");
  });
  it("rejects misleading or unknown health data", () => {
    expect(healthSchema.safeParse({ status: "healthy", service: "other" }).success).toBe(false);
  });
  it("bounds polling to supported intervals", () => {
    expect(refreshPreferenceSchema.safeParse({ interval: "0" }).success).toBe(false);
    expect(refreshPreferenceSchema.safeParse({ interval: "60" }).success).toBe(true);
  });
});
