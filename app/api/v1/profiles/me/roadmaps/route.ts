import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const learnerId = auth.user.id;
    const roadmap = await orchestrator.generateRoadmap(learnerId);
    return NextResponse.json(roadmap);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const learnerId = auth.user.id;
    const profile = await orchestrator.getProfile(learnerId);
    if (!profile.activeRoadmapId) {
      return NextResponse.json({ roadmap: null });
    }
    const roadmap = await orchestrator.getRoadmap(profile.activeRoadmapId);
    return NextResponse.json({ roadmap });
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
