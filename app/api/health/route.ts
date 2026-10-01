import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configuredProvider =
    process.env.PATHFINDER_LLM_PROVIDER ||
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      ? "gemini"
      : process.env.GROQ_API_KEY
      ? "groq"
      : process.env.OPENAI_API_KEY
      ? "openai"
      : "deterministic");

  return NextResponse.json(
    {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      environment: process.env.NODE_ENV || "production",
      llm: {
        activeProvider: configuredProvider,
        isCustomKeyConfigured: configuredProvider !== "deterministic",
      },
    },
    { status: 200 }
  );
}
