import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  createSessionToken,
  userStore,
} from "@/lib/auth/auth-service";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials format", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const user = userStore.findByEmail(email);

    if (!user || !userStore.verifyPassword(user, password)) {
      return NextResponse.json(
        { error: "Invalid email or password. Please try again." },
        { status: 401 }
      );
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    const token = createSessionToken(authUser);
    const res = NextResponse.json({
      success: true,
      user: authUser,
      token,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600, // 7 days
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Authentication failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
