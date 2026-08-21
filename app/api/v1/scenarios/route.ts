import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/application/orchestrator";
import { CreateScenarioRequestSchema } from "@/lib/contracts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateScenarioRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const scenario = await orchestrator.createScenario(
      parsed.data.baseRoadmapId,
      parsed.data.name,
      parsed.data.overrides,
      learnerId
    );

    return NextResponse.json(scenario);
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const learnerId = req.headers.get("x-learner-id") || req.nextUrl.searchParams.get("learnerId") || "demo_learner_1";
    const scenarios = await orchestrator.getScenarios(learnerId);
    return NextResponse.json({ scenarios });
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
