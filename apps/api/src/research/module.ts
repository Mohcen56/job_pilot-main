import { Controller, Post, Req, Res, UseGuards, Module } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard, webRequest, sendResponse, type AuthenticatedRequest } from "../http";
import { POST as research } from "./handle";
@Controller("api/agent")
@UseGuards(SessionGuard)
export class ResearchController {
  @Post("research")
  async research(@Req() req: AuthenticatedRequest, @Res() res: Response) { await sendResponse(res, await research(webRequest(req), req.backendContext)); }
}
@Module({ controllers: [ResearchController], providers: [SessionGuard] })
export class ResearchModule {}
