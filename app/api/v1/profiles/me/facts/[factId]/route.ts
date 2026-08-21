import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { CorrectFactRequestSchema } from "@/lib/contracts";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ factId: string }> }
) {
  try {
    const { factId } = await params;
    const body = await req.json();
    const parsed = CorrectFactRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const result = await orchestrator.correctFact(
      factId,
      {
        newValue: parsed.data.newValue,
        reason: parsed.data.reason,
      },
      learnerId
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ factId: string }> }
) {
  try {
    const { factId } = await params;
    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const result = await orchestrator.correctFact(
      factId,
      {
        revoke: true,
        reason: "Fact deleted by user",
      },
      learnerId
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
