import { All, Controller, Get, Inject, Module, Next, Req, Res } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { RequestListener } from "node:http";
import { AuthModule } from "./auth/controller";
import { JobsModule } from "./jobs/module";
import { ResearchModule } from "./research/module";
import { ProfileModule } from "./profile/module";
import { ResumesModule } from "./resumes/module";
import { AdminModule } from "./admin/module";
import { getPool } from "./database/pool";
export const NEXT_HANDLER = "NEXT_HANDLER";
@Controller("api/health")
class HealthController {
  @Get()
  health() { return { status: "ok", application: "JobHunt EZ" }; }
  @Get("ready")
  async ready(@Res() res: Response) {
    try {
      const result = await getPool().query("SELECT 1 FROM ai_settings WHERE id='global'");
      if (!result.rowCount) throw new Error("Settings migration incomplete");
      await getPool().query("SELECT email_verified FROM users LIMIT 0");
      await getPool().query("SELECT id FROM usage_leases LIMIT 0");
      await getPool().query("SELECT token_hash FROM email_verifications LIMIT 0");
      res.json({ status: "ready" });
    } catch { res.status(503).json({ status: "unavailable", error: "Database setup is incomplete" }); }
  }
}
@Controller()
class FrontendController {
  constructor(@Inject(NEXT_HANDLER) private readonly handle: RequestListener) {}
  @All("{*path}")
  async frontend(@Req() req: Request, @Res() res: Response, @Next() nextMiddleware: NextFunction) {
    // Nest registers the root module before imported modules. Pass API requests
    // onward so this page fallback cannot shadow their controllers.
    if (req.path.startsWith("/api/")) { nextMiddleware(); return; }
    await this.handle(req, res);
  }
}
@Module({})
export class AppModule {
  static register(handle: RequestListener) {
    return { module: AppModule, imports: [AuthModule, JobsModule, ResearchModule, ProfileModule, ResumesModule, AdminModule], controllers: [HealthController, FrontendController], providers: [{ provide: NEXT_HANDLER, useValue: handle }] };
  }
}
