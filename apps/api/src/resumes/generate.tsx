import type { BackendContext } from "../context";
import { limitedResponse } from "../usage";
import React from "react";
import { completeAI } from "../ai/completions";
import { AIServiceError, aiFailureResponse } from "../lib/ai-errors";
import { generatedResumeSchema } from "../lib/ai-schemas";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import type { Profile } from "@jobhunt/shared/types";
import { ResumePDF, type GeneratedContent } from "./ResumePDF";

function createResumeDocument(
  profile: Profile,
  generated: GeneratedContent,
): React.ReactElement<DocumentProps> {
  // ResumePDF renders a @react-pdf <Document>; the cast bridges React's component
  // prop inference to the renderer's document element type.
  return (
    <ResumePDF profile={profile} generated={generated} />
  ) as unknown as React.ReactElement<DocumentProps>;
}

export async function POST(_req: Request, context: BackendContext): Promise<Response> {
  return limitedResponse(context, () => generateResume(context));
}
async function generateResume(context: BackendContext): Promise<Response> {
  try {
    const user = context.user;
    if (!user) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const backend = context;

    const { data: profile, error: profileError } = await backend.database
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    if (profileError || !profile) {
      return Response.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    const profileContext = JSON.stringify({
      full_name: profile.full_name,
      current_title: profile.current_title,
      experience_level: profile.experience_level,
      years_experience: profile.years_experience,
      skills: profile.skills,
      industries: profile.industries,
      work_experience: profile.work_experience,
      education: profile.education,
      job_titles_seeking: profile.job_titles_seeking,
    });

    const raw = await completeAI({
      temperature: 0.7,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You are a professional resume writer. Given a candidate's profile data, produce a 2-3 sentence professional summary paragraph and rewrite each work experience entry's responsibilities as 3-5 concise, achievement-focused bullet points starting with strong action verbs. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Generate polished resume content for this candidate and return JSON matching this exact shape:
{
  "summary": "string — 2-3 sentence professional summary",
  "work_experience": [
    {
      "company": "string",
      "title": "string",
      "start_date": "string",
      "end_date": "string | null",
      "is_current": false,
      "bullets": ["string", "string", "string"]
    }
  ]
}

Candidate profile:
${profileContext}`,
        },
      ],
    });

    if (!raw) {
      return Response.json(
        { success: false, error: "AI returned an empty response" },
        { status: 500 },
      );
    }

    let generated: GeneratedContent;
    try {
      generated = generatedResumeSchema.parse(JSON.parse(raw));
    } catch {
      console.error("[api/resume/generate] Invalid AI response");
      return Response.json(
        {
          success: false,
          error: "The AI response could not be used. Please try again.",
        },
        { status: 500 },
      );
    }

    // Render PDF buffer server-side
    const buffer = await renderToBuffer(
      createResumeDocument(profile, generated),
    );

    // Atomically replace the private resume.
    const path = `${user.id}/resume.pdf`;

    // Wrap the generated PDF buffer for private storage.
    // Cast to ArrayBuffer to satisfy strict TS — Buffer is a safe subtype at runtime.
    const blob = new Blob([buffer as unknown as ArrayBuffer], {
      type: "application/pdf",
    });

    const { error: uploadError } = await backend.storage
      .from("resumes")
      .upload(path, blob);

    if (uploadError) {
      console.error("[api/resume/generate] storage upload", uploadError);
      return Response.json(
        { success: false, error: "Failed to upload resume" },
        { status: 500 },
      );
    }

    const { error: dbError } = await backend.database
      .from("profiles")
      .update({ resume_pdf_url: path })
      .eq("id", user.id);

    if (dbError) {
      console.error("[api/resume/generate] db update", dbError);
      return Response.json(
        { success: false, error: "Failed to save resume URL" },
        { status: 500 },
      );
    }
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof AIServiceError) return aiFailureResponse(error);
    console.error("[api/resume/generate]", "Resume generation failed");
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
