import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { IntakeMessageRequestSchema } from "@/lib/contracts";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const parsed = IntakeMessageRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const learnerId = auth.user.id;
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
