import { Controller, Get, Post, Param, Req, Res, Inject, Module, HttpCode } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService, type OAuthProvider } from "./service";
import { cookieValue, createSession, revokeSession, SESSION_COOKIE, SESSION_SECONDS } from "./session";
import { getPool } from "../database/pool";
import { activateAccount, sendVerification } from "./verification";
import { z } from "zod";
import { AuthRequestError } from "./errors";

function wantsJson(req: Request): boolean { return req.headers.accept === "application/json"; }
function authFailure(req: Request, res: Response, error: unknown, message: string, fallback: string) {
  if (!wantsJson(req)) return res.redirect(303, fallback);
  return res.status(error instanceof AuthRequestError ? error.status : 400).json({ success: false, error: error instanceof AuthRequestError ? error.message : message });
}

const options = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" });
function isProvider(provider: string): provider is OAuthProvider { return provider === "google" || provider === "github"; }

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  private async signedIn(res: Response, id: string, oldToken?: string, json = false) {
    await revokeSession(oldToken);
    res.cookie(SESSION_COOKIE, await createSession(id), { ...options(), maxAge: SESSION_SECONDS * 1000 });
    const { rows } = await getPool().query("SELECT is_complete FROM profiles WHERE id=$1", [id]);
    const redirect = rows[0]?.is_complete ? "/dashboard" : "/profile";
    if (json) return res.json({ success: true, data: { redirect } });
    res.redirect(303, redirect);
  }
  @Post("register")
  async register(@Req() req: Request, @Res() res: Response) {
    try {
      await this.auth.limit(req.ip ?? req.socket.remoteAddress ?? "unknown", req.body?.email);
      const result = await this.auth.register(req.body);
      if ("userId" in result) return this.signedIn(res, result.userId, cookieValue(req.headers.cookie, SESSION_COOKIE), wantsJson(req));
      if (wantsJson(req)) return res.json({ success: true, data: result });
      res.redirect(303, `/verify-email?email=${encodeURIComponent(String(req.body.email).toLowerCase())}`);
    } catch (error) { authFailure(req, res, error, "We couldn't start signup. Enter a valid email and try again.", "/register?error=register"); }
  }
  @Post("login")
  @HttpCode(200)
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      await this.auth.limit(req.ip ?? req.socket.remoteAddress ?? "unknown", req.body?.email);
      await this.signedIn(res, await this.auth.login(req.body), cookieValue(req.headers.cookie, SESSION_COOKIE), wantsJson(req));
    } catch (error) { authFailure(req, res, error, "We couldn't sign you in. Check your email and password. If you haven't activated your account, verify your email first.", "/login?error=credentials"); }
  }
  @Get("oauth/:provider")
  async oauth(@Param("provider") provider: string, @Req() req: Request, @Res() res: Response) {
    if (!isProvider(provider)) return res.redirect(303, "/login?error=provider");
    try {
      await this.auth.limit(req.ip ?? req.socket.remoteAddress ?? "unknown");
      const flow = await this.auth.startOAuth(provider);
      res.cookie(`jobhunt_oauth_${provider}`, flow.state, { ...options(), maxAge: 600000 });
      res.redirect(303, flow.url);
    } catch { res.redirect(303, "/login?error=oauth"); }
  }
  @Get("callback/:provider")
  async callback(@Param("provider") provider: string, @Req() req: Request, @Res() res: Response) {
    if (!isProvider(provider)) return res.redirect(303, "/login?error=provider");
    const cookie = `jobhunt_oauth_${provider}`;
    res.clearCookie(cookie, options());
    try {
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const id = await this.auth.finishOAuth(provider, state, code, cookieValue(req.headers.cookie, cookie));
      await this.signedIn(res, id, cookieValue(req.headers.cookie, SESSION_COOKIE));
    } catch { res.redirect(303, "/login?error=callback"); }
  }
  @Post("logout")
  async logout(@Req() req: Request, @Res() res: Response) {
    await revokeSession(cookieValue(req.headers.cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, options());
    res.redirect(303, "/login");
  }
  @Post("resend-verification")
  @HttpCode(200)
  async resend(@Req() req: Request, @Res() res: Response) {
    try {
      const email = z.email().max(254).parse(req.body?.email).toLowerCase();
      await this.auth.limit(req.ip ?? req.socket.remoteAddress ?? "unknown", email);
      const delivery = await sendVerification(email);
      if (wantsJson(req)) return res.json({ success: true, data: { delivery } });
      res.redirect(303, `/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) { authFailure(req, res, error, "We couldn't send a code. Check your email and try again.", "/verify-email?error=delivery"); }
  }
  @Post("verify-email")
  @HttpCode(200)
  async verify(@Req() req: Request, @Res() res: Response) {
    try {
      await this.auth.limit(req.ip ?? req.socket.remoteAddress ?? "unknown", req.body?.email);
      await activateAccount(req.body);
      if (req.headers.accept === "application/json") return res.json({ success: true });
      res.redirect(303, "/login?error=verified");
    } catch (error) { authFailure(req, res, error, "Enter a valid eight-digit code and a password of at least 12 characters.", "/verify-email?error=verification"); }
  }
}
@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
