import assert from "node:assert";
import { NextRequest } from "next/server";
import { POST as handleRegister } from "../app/api/v1/auth/register/route";
import { POST as handleLogin } from "../app/api/v1/auth/login/route";
import { GET as handleAuthMe } from "../app/api/v1/auth/me/route";
import { POST as handleLogout } from "../app/api/v1/auth/logout/route";
import { GET as handleProfilesMe } from "../app/api/v1/profiles/me/route";
import { POST as handleIntakePost } from "../app/api/v1/intake/messages/route";
import { COOKIE_NAME } from "../src/lib/auth/auth-service";

async function runUserAuthTests() {
  console.log("================================================================================");
  console.log("PATHFORGE USER AUTHENTICATION & ROUTE PROTECTION TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;

  // ----------------------------------------------------------------------------
  // Test 1: Unauthenticated request to /api/v1/profiles/me returns 401 Unauthorized
  // ----------------------------------------------------------------------------
  console.log("Test 1: Unauthenticated request to GET /api/v1/profiles/me returns 401 Unauthorized...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/profiles/me", {
      method: "GET",
    });
    const res = await handleProfilesMe(req);
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
    const body = await res.json();
    assert.strictEqual(body.error, "Unauthorized");
    console.log("  [PASS] Unauthenticated access strictly blocked with 401.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 2: Unauthenticated request to POST /api/v1/intake/messages returns 401 Unauthorized
  // ----------------------------------------------------------------------------
  console.log("\nTest 2: Unauthenticated request to POST /api/v1/intake/messages returns 401...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "I want to be a software engineer",
        modelProvider: "deterministic",
      }),
    });
    const res = await handleIntakePost(req);
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
    console.log("  [PASS] Intake messages API blocked without valid session.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 3: Registration with invalid email or short password returns 400
  // ----------------------------------------------------------------------------
  console.log("\nTest 3: Registration input validation (bad email or short password) returns 400...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "not-an-email",
        password: "123", // too short
      }),
    });
    const res = await handleRegister(req);
    assert.strictEqual(res.status, 400);
    console.log("  [PASS] Input validation strictly enforced.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 4: Register new user -> returns 201 with session token and cookie
  // ----------------------------------------------------------------------------
  console.log("\nTest 4: Register new user -> creates account, sets session cookie...");
  const testEmail = `newuser_${Date.now()}@pathforge.ai`;
  let sessionCookie = "";
  let registeredUserId = "";
  {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alex Learner",
        email: testEmail,
        password: "securePassword123!",
      }),
    });
    const res = await handleRegister(req);
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, testEmail);
    assert.strictEqual(body.user.name, "Alex Learner");
    assert.ok(body.token);

    registeredUserId = body.user.id;
    sessionCookie = `${COOKIE_NAME}=${body.token}`;

    console.log(`  [PASS] User registered successfully with ID: ${registeredUserId}`);
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 5: Login with wrong password returns 401
  // ----------------------------------------------------------------------------
  console.log("\nTest 5: Login with incorrect password returns 401...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "wrongPassword999",
      }),
    });
    const res = await handleLogin(req);
    assert.strictEqual(res.status, 401);
    console.log("  [PASS] Wrong password rejected.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 6: Login with correct password returns 200 with session cookie
  // ----------------------------------------------------------------------------
  console.log("\nTest 6: Login with correct password returns 200 and session token...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "securePassword123!",
      }),
    });
    const res = await handleLogin(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.email, testEmail);
    assert.ok(body.token);
    sessionCookie = `${COOKIE_NAME}=${body.token}`;
    console.log("  [PASS] Successful login verified.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 7: GET /api/v1/auth/me with session cookie returns authenticated user
  // ----------------------------------------------------------------------------
  console.log("\nTest 7: GET /api/v1/auth/me returns authenticated user session...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: {
        cookie: sessionCookie,
      },
    });
    const res = await handleAuthMe(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.authenticated, true);
    assert.strictEqual(body.user.id, registeredUserId);
    console.log("  [PASS] Session introspection validated.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 8: Authenticated request to /api/v1/profiles/me succeeds
  // ----------------------------------------------------------------------------
  console.log("\nTest 8: Authenticated request to GET /api/v1/profiles/me succeeds with user ID...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/profiles/me", {
      method: "GET",
      headers: {
        cookie: sessionCookie,
      },
    });
    const res = await handleProfilesMe(req);
    assert.strictEqual(res.status, 200);
    const profile = await res.json();
    assert.strictEqual(profile.id, registeredUserId);
    console.log("  [PASS] Authenticated user profile accessed safely.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 9: Default seeded demo accounts login immediately
  // ----------------------------------------------------------------------------
  console.log("\nTest 9: Default seeded demo account (demo@pathforge.ai) can log in...");
  {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo@pathforge.ai",
        password: "password123",
      }),
    });
    const res = await handleLogin(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.id, "demo_learner_1");
    assert.strictEqual(body.user.email, "demo@pathforge.ai");
    console.log("  [PASS] Default demo account verified.");
    passed++;
  }

  // ----------------------------------------------------------------------------
  // Test 10: Logout endpoint clears session cookie
  // ----------------------------------------------------------------------------
  console.log("\nTest 10: POST /api/v1/auth/logout clears session cookie...");
  {
    const res = await handleLogout();
    assert.strictEqual(res.status, 200);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("Max-Age=0") || setCookie.includes("max-age=0") || setCookie.includes("expires="));
    console.log("  [PASS] Logout clears cookie properly.");
    passed++;
  }

  console.log(`\n================================================================================`);
  console.log(`ALL ${passed}/10 USER AUTHENTICATION & PROTECTION TESTS PASSED (100% SUCCESS)!`);
  console.log(`================================================================================\n`);
}

runUserAuthTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
