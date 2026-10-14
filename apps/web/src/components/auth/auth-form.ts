export const inputClass = "min-h-12 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
export const buttonClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60";

export async function authRequest(endpoint: string, body: Record<string, unknown>): Promise<{ delivery?: string; redirect?: string }> {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: "POST", mode: "cors", credentials: "same-origin", referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true) {
    throw new Error(typeof result.error === "string" ? result.error : "Something went wrong. Please try again.");
  }
  return result.data ?? {};
}
