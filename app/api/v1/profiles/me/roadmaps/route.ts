import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const roadmap = await orchestrator.generateRoadmap(learnerId);
    return NextResponse.json(roadmap);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
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
