import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  createSessionToken,
  userStore,
} from "@/lib/auth/auth-service";

export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          message: parsed.error.issues[0]?.message || "Invalid input",
        },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if email already registered
    const existing = userStore.findByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }

    const authUser = userStore.createUser(name, email, password);
    const token = createSessionToken(authUser);

    const res = NextResponse.json(
      {
        success: true,
        user: authUser,
        token,
      },
      { status: 201 }
    );

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
      { error: "Registration failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
