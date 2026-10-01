import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const learnerId = auth.user.id;
    const profile = await orchestrator.getProfile(learnerId);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const learnerId = auth.user.id;
    const profile = await orchestrator.resetState(learnerId);
    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
