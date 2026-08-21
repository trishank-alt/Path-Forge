import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";

export async function GET(req: NextRequest) {
  try {
    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const profile = await orchestrator.getProfile(learnerId);
    const savedRoadmaps = await orchestrator.getSavedRoadmaps(learnerId);
    return NextResponse.json({
      activeRoadmapId: profile.activeRoadmapId,
      savedRoadmaps,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
