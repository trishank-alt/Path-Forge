import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";

export async function GET(req: NextRequest) {
  try {
    const events = await orchestrator.getAuditEvents(100);
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
