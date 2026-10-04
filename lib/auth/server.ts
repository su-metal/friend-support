import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  importX509,
  jwtVerify,
} from "jose";
import { appUrl, firebaseProjectId, isDemoMode } from "@/lib/env";
import { signGrant, verifyGrant } from "@/lib/security";
import { googleAccessToken } from "@/lib/firebase/oauth";
import { demoUser } from "@/services/demo";
import { AppError } from "@/lib/errors";
import type { AuthService } from "@/services/contracts";
const cookieName = "friend-support-session";
async function adminAuth(path: string, body: object) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${firebaseProjectId()}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await googleAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new AppError("auth", "ログインをやり直してください", 401);
  return response.json();
}
class FirebaseAuthService implements AuthService {
  async currentUser() {
    const token = (await cookies()).get(cookieName)?.value;
    if (!token) return null;
    if (isDemoMode()) {
      const grant = await verifyGrant(token);
      return grant?.purpose === "demo-auth" ? demoUser : null;
    }
    try {
      const { kid } = decodeProtectedHeader(token);
      if (!kid) return null;
      const response = await fetch(
        "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys",
        { cache: "no-store", signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) return null;
      const certs = (await response.json()) as Record<string, string>;
      if (!certs[kid]) return null;
      const { payload } = await jwtVerify(
        token,
        await importX509(certs[kid], "RS256"),
        {
          algorithms: ["RS256"],
          issuer: `https://session.firebase.google.com/${firebaseProjectId()}`,
          audience: firebaseProjectId(),
        },
      );
      if (
        !payload.sub ||
        payload.sub.length > 128 ||
        payload.email_verified !== true ||
        typeof payload.auth_time !== "number"
      )
        return null;
      const { users } = (await adminAuth("/accounts:lookup", {
        localId: [payload.sub],
      })) as {
        users?: {
          localId: string;
          email: string;
          disabled?: boolean;
          validSince?: string;
        }[];
      };
      const user = users?.[0];
      if (
        !user ||
        user.disabled ||
        Number(user.validSince ?? 0) > payload.auth_time
      )
        return null;
      return { id: user.localId, email: user.email };
    } catch {
      return null;
    }
  }
  async createSession(idToken: string) {
    if (isDemoMode()) return signGrant({ purpose: "demo-auth" });
    const keys = createRemoteJWKSet(
      new URL(
        "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      ),
    );
    const { payload } = await jwtVerify(idToken, keys, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${firebaseProjectId()}`,
      audience: firebaseProjectId(),
    });
    if (
      !payload.sub ||
      typeof payload.auth_time !== "number" ||
      Math.floor(Date.now() / 1000) - payload.auth_time > 300 ||
      payload.auth_time > Math.floor(Date.now() / 1000) ||
      payload.email_verified !== true
    )
      throw new AppError("auth", "新しいログインリンクを開いてください", 401);
    const { sessionCookie } = (await adminAuth(":createSessionCookie", {
      idToken,
      validDuration: "604800",
    })) as { sessionCookie: string };
    return sessionCookie;
  }
  async signOut() {
    (await cookies()).delete(cookieName);
  }
}
export const authService = new FirebaseAuthService();
export const currentUser = cache(() => authService.currentUser());
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("unauthorized", "ログインしてください", 401);
  return user;
}
export async function setSession(token: string) {
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: new URL(appUrl()).protocol === "https:",
    sameSite: "lax",
    maxAge: 604800,
    path: "/",
  });
}
