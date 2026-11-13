import { apiErrorSchema, liveHealthSchema, readyHealthSchema } from "@zeaops/contracts";
import { getServerEnvironment } from "../../../../lib/env";

export const dynamic = "force-dynamic";
const MAX_HEALTH_BYTES = 8192;

async function readHealthBody(response: Response): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json" ||
    !response.body
  ) {
    throw new Error("Invalid health content type");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HEALTH_BYTES) throw new Error("Health payload exceeds limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(data)) as unknown;
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const correlationId = crypto.randomUUID();
  const headers = { "Cache-Control": "no-store", "X-Correlation-ID": correlationId };
  function failure(status: number, code: string, message: string) {
    return Response.json(
      { error: { code, message, correlation_id: correlationId } },
      { status, headers },
    );
  }
  const { kind } = await params;
  if (kind !== "live" && kind !== "ready") return failure(404, "not_found", "Unknown health check");
  try {
    const env = getServerEnvironment();
    const upstream = await fetch(`${env.ZEAOPS_API_INTERNAL_URL}/health/${kind}`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7000),
      headers: { "X-Correlation-ID": correlationId },
    });
    // Fixed endpoints only. Never forward credentials, redirects, raw errors, or arbitrary payloads.
    const body = await readHealthBody(upstream);
    if (upstream.status !== 200) {
      const error = apiErrorSchema.safeParse(body);
      const knownMessages = ["Metadata database is not ready", "Metadata schema is not ready"];
      if (
        kind === "ready" &&
        upstream.status === 503 &&
        error.success &&
        error.data.error.code === "not_ready" &&
        knownMessages.includes(error.data.error.message)
      ) {
        return failure(503, "not_ready", error.data.error.message);
      }
      return failure(502, "invalid_upstream", "API health check failed");
    }
    const parsed = (kind === "live" ? liveHealthSchema : readyHealthSchema).safeParse(body);
    if (!parsed.success) return failure(502, "invalid_upstream", "API health response is invalid");
    return Response.json(parsed.data, { headers });
  } catch {
    return failure(503, "upstream_unavailable", "API connection unavailable");
  }
}
