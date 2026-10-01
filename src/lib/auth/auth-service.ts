import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
  salt: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  exp: number; // Unix timestamp in seconds
}

const AUTH_SECRET = process.env.AUTH_SECRET || "pathforge-production-auth-secret-key-2026";
const COOKIE_NAME = "pathforge_session";
const USERS_FILE_PATH = path.join(process.cwd(), "scratch", "users.json");

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

class UserStore {
  private users: Map<string, StoredUser> = new Map(); // keyed by email (lowercase)
  private idIndex: Map<string, StoredUser> = new Map(); // keyed by user ID

  constructor() {
    this.loadFromDisk();
    this.seedDefaultUsers();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(USERS_FILE_PATH)) {
        const data = fs.readFileSync(USERS_FILE_PATH, "utf-8");
        const list: StoredUser[] = JSON.parse(data);
        for (const u of list) {
          this.users.set(u.email.toLowerCase(), u);
          this.idIndex.set(u.id, u);
        }
      }
    } catch {
      // In-memory fallback
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(USERS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const list = Array.from(this.users.values());
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(list, null, 2), "utf-8");
    } catch {
      // Disk write failure fallback
    }
  }

  private seedDefaultUsers() {
    // 1. Seed demo user if missing
    if (!this.users.has("demo@pathforge.ai")) {
      const salt = crypto.randomBytes(16).toString("hex");
      const demoUser: StoredUser = {
        id: "demo_learner_1",
        email: "demo@pathforge.ai",
        name: "Demo Engineer",
        passwordHash: hashPassword("password123", salt),
        salt,
        createdAt: new Date().toISOString(),
      };
      this.users.set(demoUser.email.toLowerCase(), demoUser);
      this.idIndex.set(demoUser.id, demoUser);
    }

    // 2. Seed Trishank personal profile if missing
    if (!this.users.has("trishank@pathforge.ai")) {
      const salt = crypto.randomBytes(16).toString("hex");
      const trishankUser: StoredUser = {
        id: "trishank",
        email: "trishank@pathforge.ai",
        name: "Trishank",
        passwordHash: hashPassword("password123", salt),
        salt,
        createdAt: new Date().toISOString(),
      };
      this.users.set(trishankUser.email.toLowerCase(), trishankUser);
      this.idIndex.set(trishankUser.id, trishankUser);
    }

    this.saveToDisk();
  }

  public findByEmail(email: string): StoredUser | null {
    return this.users.get(email.trim().toLowerCase()) || null;
  }

  public findById(id: string): StoredUser | null {
    return this.idIndex.get(id) || null;
  }

  public createUser(name: string, email: string, password: string): AuthUser {
    const cleanEmail = email.trim().toLowerCase();
    if (this.users.has(cleanEmail)) {
      throw new Error("A user with this email already exists.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const id = `user_${cleanEmail.replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36)}`;

    const newUser: StoredUser = {
      id,
      email: cleanEmail,
      name: name.trim(),
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    };

    this.users.set(cleanEmail, newUser);
    this.idIndex.set(id, newUser);
    this.saveToDisk();

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
    };
  }

  public verifyPassword(user: StoredUser, password: string): boolean {
    const computed = hashPassword(password, user.salt);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(user.passwordHash));
  }
}

export const userStore = new UserStore();

// ------------------------------------------------------------------------------
// Stateless HMAC Signed Session Tokens
// ------------------------------------------------------------------------------

export function createSessionToken(user: AuthUser, expiresInDays = 7): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 3600;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes(".")) return null;

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSig = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payloadB64)
    .digest("base64url");

  if (
    signature.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    return null;
  }

  try {
    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
