import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const body = await req.json();
    const { roadmapId } = body;
    if (!roadmapId) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "roadmapId is required" }, { status: 400 });
    }
    const result = await orchestrator.switchActiveRoadmap(roadmapId, learnerId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
