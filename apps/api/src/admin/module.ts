import { Controller, Get, Post, Req, Res, UseGuards, Module } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard, type AuthenticatedRequest } from "../http";
import { isAdminUser } from "./authorization";
import { getAISettings } from "../ai/settings";
import { getProviderStatuses } from "../ai/config";
import { saveAIProvider } from "./service";
@Controller("api/admin")
@UseGuards(SessionGuard)
export class AdminController {
  @Get("ai-settings")
  async get(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    if (!await isAdminUser(req.backendContext)) return res.status(403).json({ success: false, error: "Admin access required" });
    res.json({ success: true, data: { settings: await getAISettings(), providers: getProviderStatuses() } });
  }
  @Post("ai-settings")
  async save(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    if (!await isAdminUser(req.backendContext)) return res.status(403).json({ success: false, error: "Admin access required" });
    const result = await saveAIProvider(req.body?.provider, req.backendContext);
    res.status(result.success ? 200 : 400).json(result);
  }
}
@Module({ controllers: [AdminController], providers: [SessionGuard] })
export class AdminModule {}
