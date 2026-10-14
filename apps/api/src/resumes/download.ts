import type { BackendContext } from "../context";


export async function GET(_req: Request, context: BackendContext): Promise<Response> {
  try {
    const user = context.user;
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backend = context;

    const { data: profile } = await backend.database
      .from("profiles")
      .select("resume_pdf_url")
      .eq("id", user.id)
      .maybeSingle<{ resume_pdf_url: string | null }>();

    if (!profile?.resume_pdf_url) {
      return Response.json({ error: "No resume on file" }, { status: 404 });
    }

    const { data: blob, error } = await backend.storage
      .from("resumes")
      .download(profile.resume_pdf_url);

    if (error || !blob) {
      console.error("[api/resume/download]", error);
      return Response.json(
        { error: "Failed to download resume" },
        { status: 500 },
      );
    }

    const buffer = await blob.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/resume/download]", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
