import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const learnerId = auth.user.id;
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
