import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  let targetPhaseId = "unknown";
  try {
    const { phaseId } = await params;
    targetPhaseId = phaseId;
    const body = await req.json().catch(() => ({}));
    const learnerId =
      req.headers.get("x-learner-id") ||
      req.nextUrl.searchParams.get("learnerId") ||
      body.profileId ||
      "demo_learner_1";

    const result = await orchestrator.submitWork(phaseId, {
      profileId: learnerId,
      notes: body.notes,
      deliverableUrl: body.deliverableUrl,
      demonstratedCapabilities: body.demonstratedCapabilities,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`API /v1/profiles/me/phases/${targetPhaseId}/submit error:`, err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
