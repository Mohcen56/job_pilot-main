import type { BackendContext } from "../context";

import { MATCH_THRESHOLD } from "./constants";
import type { Job } from "@jobhunt/shared/types";

const PAGE_SIZE = 20;

export async function GET(req: Request, context: BackendContext) {
  try {
    const user = context.user;
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const backend = context;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const matchFilter = searchParams.get("matchFilter") ?? "all";
    const sortOption = searchParams.get("sortOption") ?? "score";
    const freshnessDays = Number(searchParams.get("freshnessDays"));
    const page = Math.min(100000, Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1));

    let query = backend.database
      .from("jobs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);

    if (matchFilter === "high") {
      query = query.gte("match_score", MATCH_THRESHOLD);
    } else if (matchFilter === "low") {
      query = query.lt("match_score", MATCH_THRESHOLD);
    }

    if (search) {
      query = query.searchText(["title", "company"], search);
    }
    if ([1,3,7,14,30].includes(freshnessDays)) {
      query = query.gte("published_at", new Date(Date.now()-freshnessDays*86400000).toISOString());
    }

    if (sortOption === "score") {
      query = query.order("match_score", { ascending: false, nullsFirst: false });
    } else if (sortOption === "newest") {
      query = query.order("published_at", { ascending: false, nullsFirst: false });
    } else if (sortOption === "oldest") {
      query = query.order("published_at", { ascending: true, nullsFirst: false });
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query.rows<Job>();

    if (error) {
      console.error("[api/jobs]", error);
      return Response.json(
        { success: false, error: "Failed to fetch jobs" },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      data: {
        jobs: data ?? [],
        totalCount: count ?? 0,
        page,
        pageSize: PAGE_SIZE,
      },
    });
  } catch (error) {
    console.error("[api/jobs]", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
