import type { Request, Response, NextFunction } from "express";
import { appUrl } from "./auth/service";

/** Reject untrusted routing headers before handing requests to either framework. */
export function trustedHost(req: Request, res: Response, next: NextFunction): void {
  const host = new URL(appUrl()).host.toLowerCase();
  if (req.headers.host?.toLowerCase() !== host ||
      (req.headers["x-forwarded-host"] !== undefined && req.headers["x-forwarded-host"] !== host)) {
    res.status(400).send("Invalid request host");
    return;
  }
  // Next uses this header for action forwarding. Do not accept an arbitrary origin.
  req.headers["x-forwarded-host"] = host;
  req.headers["x-forwarded-proto"] = new URL(appUrl()).protocol.slice(0,-1);
  next();
}

export function trustedProxies(): string[] | false {
  const proxies = process.env.TRUSTED_PROXIES?.split(",").map((value) => value.trim()).filter(Boolean);
  if (!proxies?.length) return false;
  // Explicit addresses/subnets only; never blindly trust client-supplied forwarded headers.
  if (proxies.some((value) => value === "true" || /^\d+$/.test(value))) {
    throw new Error("TRUSTED_PROXIES must contain proxy IP addresses or subnets");
  }
  return proxies;
}
