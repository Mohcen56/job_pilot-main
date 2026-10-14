import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workspaceRoot } from "../paths";

export class ResumeStorage {
  constructor(private readonly userId: string) {}
  from(bucket: string) {
    if (bucket !== "resumes") throw new Error("Unknown storage bucket");
    return this;
  }
  private file(key: string) {
    if (!/^[0-9a-f-]{36}$/i.test(this.userId) || key !== `${this.userId}/resume.pdf`) throw new Error("File access denied");
    return path.resolve(workspaceRoot, process.env.STORAGE_DIR || "./data/resumes", this.userId, "resume.pdf");
  }
  async upload(key: string, file: Blob) {
    let temporary: string | undefined;
    try {
      const target = this.file(key);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length > 2 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF");
      await mkdir(path.dirname(target), { recursive: true });
      temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
      await rename(temporary, target);
      return { data: { key, url: "/api/resume/download" }, error: null };
    } catch {
      if (temporary) await rm(temporary, { force: true });
      return { data: null, error: { message: "Could not store PDF" } };
    }
  }
  async download(key: string) {
    try {
      const bytes = await readFile(this.file(key));
      return { data: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), error: null };
    } catch { return { data: null, error: { message: "Resume not found" } }; }
  }
}
