import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { AssessmentSubmissionRequestSchema } from "@/lib/contracts";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { assessmentId } = await params;
    const body = await req.json();
    const parsed = AssessmentSubmissionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const learnerId = auth.user.id;
    const result = await orchestrator.submitAssessment(
      parsed.data.skillId,
      parsed.data.score,
      parsed.data.passed,
      learnerId,
      parsed.data.notes
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
