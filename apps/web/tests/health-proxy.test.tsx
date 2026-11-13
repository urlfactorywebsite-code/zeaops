import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../app/api/health/[kind]/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function call(kind = "ready") {
  return GET(
    new Request(`http://localhost/api/health/${kind}`, {
      headers: { Cookie: "session=private", Authorization: "Bearer private" },
    }),
    { params: Promise.resolve({ kind }) },
  );
}
it("validates health data, strips extras, and forwards no incoming credentials", async () => {
  vi.stubEnv("ZEAOPS_API_INTERNAL_URL", "http://127.0.0.1:18301");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ status: "ready", service: "zeaops-api", private: "must-not-leak" }),
    );
  vi.stubGlobal("fetch", fetcher);
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ready", service: "zeaops-api" });
  const options = fetcher.mock.calls[0]?.[1];
  expect(options.redirect).toBe("error");
  expect(Object.keys(options.headers)).toEqual(["X-Correlation-ID"]);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each([
  () => Response.json({ status: "ok", service: "zeaops-api" }),
  () =>
    new Response("private traceback", { status: 500, headers: { "Content-Type": "text/html" } }),
  () =>
    Response.json(
      { error: { code: "internal", message: "private traceback", correlation_id: "x" } },
      { status: 500 },
    ),
  () => Response.json({ private: "x".repeat(9000) }),
])("rejects invalid, unsafe, or oversized upstream payloads", async (upstream) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream()));
  const response = await call();
  expect(response.status).toBeGreaterThanOrEqual(500);
  expect(await response.text()).not.toContain("private");
});
it("preserves only known sanitized readiness errors and its own correlation ID", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "not_ready",
            message: "Metadata database is not ready",
            correlation_id: "untrusted",
          },
        },
        { status: 503 },
      ),
    ),
  );
  const response = await call();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.error.correlation_id).toBe(response.headers.get("x-correlation-id"));
  expect(body.error.correlation_id).not.toBe("untrusted");
});
it("rejects unknown paths without contacting the upstream", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const response = await call("private");
  expect(response.status).toBe(404);
  expect(response.headers.get("x-correlation-id")).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});
it("sanitizes failures and invalid server configuration", async () => {
  vi.stubEnv("ZEAOPS_API_INTERNAL_URL", "http://user:private@localhost");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const response = await call();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
  expect(fetcher).not.toHaveBeenCalled();
});
