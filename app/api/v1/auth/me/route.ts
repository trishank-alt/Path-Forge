import { NextRequest, NextResponse } from "next/server";
import { resolveAuthUser } from "@/lib/auth/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = resolveAuthUser(req);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}
