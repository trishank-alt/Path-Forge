import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { ReflectionSubmission } from "@/lib/contracts";

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

    const submission: ReflectionSubmission = {
      phaseId,
      completesPhase: body.completesPhase ?? false,
      overallExperience: body.overallExperience,
      enjoyed: body.enjoyed,
      disliked: body.disliked,
      wantMoreOf: body.wantMoreOf,
      wantToAvoid: body.wantToAvoid,
      matchedExpectations: body.matchedExpectations,
      selfDiscovery: body.selfDiscovery,
      wouldChange: body.wouldChange,
      continueDirection: body.continueDirection,
      voluntarilyExplored: body.voluntarilyExplored,
      energizing: body.energizing,
      exhausting: body.exhausting,
      difficult: body.difficult,
      deeperUnderstanding: body.deeperUnderstanding,
      attemptHarder: body.attemptHarder,
      preferNext: body.preferNext,
      freeText: body.freeText,
    };

    const result = await orchestrator.submitReflection(submission, learnerId);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`API /v1/profiles/me/phases/${targetPhaseId}/reflection error:`, err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
