import { Controller, Get, Post, Req, Res, UseGuards, Module } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard, webRequest, sendResponse, type AuthenticatedRequest } from "../http";
import { POST as generate } from "./generate";
import { GET as download } from "./download";
@Controller("api/resume")
@UseGuards(SessionGuard)
export class ResumesController {
  @Post("generate")
  async generate(@Req() req: AuthenticatedRequest, @Res() res: Response) { await sendResponse(res, await generate(webRequest(req), req.backendContext)); }
  @Get("download")
  async download(@Req() req: AuthenticatedRequest, @Res() res: Response) { await sendResponse(res, await download(webRequest(req), req.backendContext)); }
}
@Module({ controllers: [ResumesController], providers: [SessionGuard] })
export class ResumesModule {}
