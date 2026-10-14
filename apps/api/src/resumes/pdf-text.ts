import { createRequire } from "node:module";
import path from "node:path";
import { workspaceRoot } from "../paths";

type PDFPage = { getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }> };
type PDFDocument = { numPages: number; getPage(page: number): Promise<PDFPage> };
type PDFTask = { promise: Promise<PDFDocument>; destroy(): Promise<void> };
type PDFReader = { getDocument(options: { data: Uint8Array; isEvalSupported: boolean; disableFontFace: boolean; verbosity: number }): PDFTask };

export class ResumePDFError extends Error {}

export async function readResumeText(bytes: Uint8Array): Promise<string> {
  // Keep the binary reader and its worker in Node, outside Next/Turbopack.
  // Resolve from the package that owns this dependency in the isolated workspace.
  const nativeRequire = createRequire(path.join(workspaceRoot, "apps/api/package.json"));
  const reader = nativeRequire("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js") as PDFReader;
  const task = reader.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let page = 1; page <= document.numPages; page++) {
      const content = await (await document.getPage(page)).getTextContent();
      pages.push(content.items.map(item => item.str ?? "").join(" "));
    }
    const text = pages.join("\n").trim();
    if (text.length < 50) throw new ResumePDFError("This PDF has too little readable text. If it's scanned, export a PDF with selectable text or fill in your profile manually.");
    return text;
  } catch (error) {
    if (error instanceof ResumePDFError) throw error;
    if (error instanceof Error && error.name === "PasswordException") {
      throw new ResumePDFError("This PDF is password-protected. Remove its password and upload it again.");
    }
    throw new ResumePDFError("We couldn't read this PDF. Export your resume as a new PDF with selectable text and upload it again.");
  } finally { await task.destroy(); }
}
