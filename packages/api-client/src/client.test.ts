import { afterEach, expect, it, vi } from "vitest";
import { getHealth } from "./index";

afterEach(() => vi.unstubAllGlobals());
it("decodes live health with a bounded same-origin request", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "ok", service: "zeaops-api" }));
  vi.stubGlobal("fetch", fetcher);
  expect((await getHealth("live")).status).toBe("ok");
  expect(fetcher).toHaveBeenCalledWith(
    "/api/health/live",
    expect.objectContaining({ cache: "no-store" }),
  );
});
it("preserves sanitized errors and request IDs", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "not_ready",
            message: "Metadata database is not ready",
            correlation_id: "test-id",
          },
        },
        { status: 503 },
      ),
    ),
  );
  await expect(getHealth("ready")).rejects.toMatchObject({
    status: 503,
    correlationId: "test-id",
    message: "Metadata database is not ready",
  });
});
it("rejects invalid successful payloads", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "fake" })));
  await expect(getHealth("live")).rejects.toThrow();
});
it("rejects a liveness response presented as database readiness", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ status: "ok", service: "zeaops-api" })),
  );
  await expect(getHealth("ready")).rejects.toMatchObject({
    name: "ApiError",
    message: "The health service returned an invalid response",
  });
});
it("does not display raw HTML or parser excerpts on non-JSON responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("private upstream traceback", { status: 502 })),
  );
  await expect(getHealth("live")).rejects.toMatchObject({
    name: "ApiError",
    status: 502,
    message: "The health service returned an invalid response",
  });
});
