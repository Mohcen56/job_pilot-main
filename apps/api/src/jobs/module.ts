import { Controller, Get, Post, Req, Res, UseGuards, Module, Injectable, Inject } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard, webRequest, sendResponse, type AuthenticatedRequest } from "../http";
import { POST as findJobs } from "./find";
import { GET as listJobs } from "./list";

@Injectable()
export class JobsService {
  find(req: AuthenticatedRequest) { return findJobs(webRequest(req), req.backendContext); }
  list(req: AuthenticatedRequest) { return listJobs(webRequest(req), req.backendContext); }
}
@Controller("api")
@UseGuards(SessionGuard)
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}
  @Get("jobs")
  async list(@Req() req: AuthenticatedRequest, @Res() res: Response) { await sendResponse(res, await this.jobs.list(req)); }
  @Post("agent/find")
  async find(@Req() req: AuthenticatedRequest, @Res() res: Response) { await sendResponse(res, await this.jobs.find(req)); }
}
@Module({ controllers: [JobsController], providers: [JobsService, SessionGuard] })
export class JobsModule {}
