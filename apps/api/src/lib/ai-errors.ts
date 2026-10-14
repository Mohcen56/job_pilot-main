import {
  AI_PROVIDER_LABELS,
  type AIFailure,
  type AIProvider,
} from "@jobhunt/shared/ai";

export class AIServiceError extends Error {
  constructor(
    public readonly failure: AIFailure,
    public readonly status: number = 503,
  ) {
    super(failure.error);
    this.name = "AIServiceError";
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function parseRetryAfter(
  value: unknown,
  now: number = Date.now(),
): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds
    : (Date.parse(value) - now) / 1000;
  return Number.isFinite(delay) && delay > 0 ? Math.ceil(delay) : undefined;
}

export function normalizeAIError(
  error: unknown,
  provider: AIProvider,
  depth: number = 0,
): AIServiceError {
  if (error instanceof AIServiceError) return error;
  const source = record(error);
  const nested = source.cause ?? source.lastError;
  if (nested && nested !== error && depth < 3) {
    const normalized = normalizeAIError(nested, provider, depth + 1);
    if (normalized.failure.code === "AI_LIMIT_REACHED") return normalized;
  }
  const body = record(source.error);
  const status = source.status ?? source.statusCode ?? body.code;
  const isLimit = status === 429 || body.status === "RESOURCE_EXHAUSTED";
  const headers = source.headers ?? source.responseHeaders;
  const retryHeader =
    headers instanceof Headers
      ? headers.get("retry-after")
      : record(headers)["retry-after"];
  let retryAfterSeconds = parseRetryAfter(retryHeader);
  if (!retryAfterSeconds && Array.isArray(body.details)) {
    for (const detail of body.details) {
      const delay = record(detail).retryDelay;
      if (typeof delay === "string" && /^\d+(\.\d+)?s$/.test(delay)) {
        retryAfterSeconds = parseRetryAfter(delay.slice(0, -1));
      }
    }
  }
  if (isLimit) {
    const quota =
      body.code === "insufficient_quota" ||
      body.code === "billing_hard_limit_reached";
    return new AIServiceError(
      {
        success: false,
        code: "AI_LIMIT_REACHED",
        provider,
        error: quota
          ? `${AI_PROVIDER_LABELS[provider]} has reached its usage allowance. An administrator can check the plan or switch the AI provider.`
          : `${AI_PROVIDER_LABELS[provider]} has reached a request or usage limit. Please try again later, or ask an administrator to switch the AI provider.`,
        ...(retryAfterSeconds && !quota ? { retryAfterSeconds } : {}),
      },
      429,
    );
  }
  const label = AI_PROVIDER_LABELS[provider];
  // The OpenAI SDK subclasses Error without setting .name (which remains "Error").
  const kind = typeof source.constructor === "function" && source.name === "Error"
    ? source.constructor.name : source.name;
  const timedOut = kind === "APIConnectionTimeoutError" || kind === "TimeoutError" || kind === "AbortError";
  const message = timedOut
    ? `${label} took too long to respond. Please try again with fewer roles or locations.`
    : status === 401 || status === 403
      ? `${label} rejected the connection. Ask an administrator to check its API key and permissions.`
      : status === 404
        ? `${label} could not find the configured model. Ask an administrator to check the AI model setting.`
        : status === 400 || status === 422
          ? `${label} rejected the request settings. Ask an administrator to check the AI model and request configuration.`
          : typeof status === "number" && status >= 500
            ? `${label} is temporarily unavailable. Please try again later.`
            : kind === "APIConnectionError"
              ? `Could not connect to ${label}. Check the server's internet connection and try again.`
              : `${label} could not complete this request. Please try again, or ask an administrator to check the AI settings.`;
  return new AIServiceError({
    success: false,
    code: "AI_UNAVAILABLE",
    provider,
    error: message,
  });
}

export function aiFailureResponse(error: AIServiceError): Response {
  return Response.json(error.failure, {
    status: error.status,
    headers: error.failure.retryAfterSeconds
      ? { "Retry-After": String(error.failure.retryAfterSeconds) }
      : undefined,
  });
}
