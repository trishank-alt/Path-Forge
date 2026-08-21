import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { IntakeMessageRequestSchema } from "@/lib/contracts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = IntakeMessageRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const result = await orchestrator.handleIntake(parsed.data, learnerId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("API /v1/intake/messages error:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
