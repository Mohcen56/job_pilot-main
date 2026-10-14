import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ServiceUnavailableException } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { contextFromRequest, type BackendContext } from "./context";
import { appUrl } from "./auth/service";

export type AuthenticatedRequest = ExpressRequest & { backendContext: BackendContext };
export function webRequest(req: ExpressRequest): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
  return new Request(new URL(req.originalUrl, appUrl()), {
    method: req.method, headers,
    ...(!["GET", "HEAD"].includes(req.method) ? { body: JSON.stringify(req.body ?? {}) } : {}),
  });
}
export async function sendResponse(res: ExpressResponse, result: Response) {
  res.status(result.status);
  result.headers.forEach((value, key) => res.setHeader(key, value));
  res.setHeader("Cache-Control", "no-store");
  res.send(Buffer.from(await result.arrayBuffer()));
}
export function isAllowedOrigin(origin: string | undefined) {
  return origin === appUrl();
}
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try { req.backendContext = await contextFromRequest(webRequest(req)); }
    catch { throw new ServiceUnavailableException("Database is temporarily unavailable"); }
    if (!req.backendContext.user) throw new UnauthorizedException("Please sign in");
    return true;
  }
}
