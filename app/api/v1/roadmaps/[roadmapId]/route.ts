import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { roadmapId } = await params;
    const roadmap = await orchestrator.getRoadmap(roadmapId);
    if (!roadmap) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Roadmap not found" }, { status: 404 });
    }
    return NextResponse.json(roadmap);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
