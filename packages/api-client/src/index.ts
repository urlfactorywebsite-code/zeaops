import {
  apiErrorSchema,
  liveHealthSchema,
  readyHealthSchema,
  type Health,
} from "@zeaops/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Browser calls stay same-origin; only health routes are exposed by the web proxy. */
export async function getHealth(kind: "live" | "ready", signal?: AbortSignal): Promise<Health> {
  const response = await fetch(`/api/health/${kind}`, {
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("The health service returned an invalid response", response.status);
  }
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiError(
      parsed.success ? parsed.data.error.message : "The health service is unavailable",
      response.status,
      parsed.success ? parsed.data.error.correlation_id : undefined,
    );
  }
  const parsed = (kind === "live" ? liveHealthSchema : readyHealthSchema).safeParse(body);
  if (!parsed.success) {
    throw new ApiError("The health service returned an invalid response", response.status);
  }
  return parsed.data;
}
