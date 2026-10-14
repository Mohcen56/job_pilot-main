import { Controller, Get, Post, Req, Res, UseGuards, Module, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { SessionGuard, type AuthenticatedRequest } from "../http";
import { saveProfile, uploadResume, extractProfile } from "./service";
@Controller("api/profile")
@UseGuards(SessionGuard)
export class ProfileController {
  @Get()
  async get(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const result = await req.backendContext.database.from("profiles").select("*").maybeSingle();
    res.status(result.error ? 503 : 200).json({ success: !result.error, data: result.data });
  }
  @Post()
  async save(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const result = await saveProfile(req.body, req.backendContext);
    res.status(result.success ? 200 : 400).json(result);
  }
  @Post("resume")
  @UseInterceptors(FileInterceptor("resume", { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }))
  async upload(@UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    if (!file) return res.status(400).json({ success: false, error: "Select a PDF to upload" });
    const form = new FormData();
    form.set("resume", new File([new Uint8Array(file.buffer)], file.originalname, { type: file.mimetype }));
    const result = await uploadResume(form, req.backendContext);
    res.status(result.success ? 200 : 400).json(result);
  }
  @Post("extract")
  async extract(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const result = await extractProfile(req.backendContext);
    if (result.retryAfterSeconds) res.setHeader("Retry-After", result.retryAfterSeconds);
    res.status(result.success ? 200 : ["AI_LIMIT_REACHED", "APP_LIMIT_REACHED"].includes(result.code ?? "") ? 429 : 400).json(result);
  }
}
@Module({ controllers: [ProfileController], providers: [SessionGuard] })
export class ProfileModule {}
