import { SignJWT, jwtVerify } from "jose";
import { secret } from "@/lib/env";
const encoder = new TextEncoder();
export function secureToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url",
  );
}
export async function hashToken(input: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", encoder.encode(input)),
  ).toString("hex");
}
export async function signGrant(
  payload: Record<string, string>,
  duration = "7d",
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(duration)
    .sign(encoder.encode(secret()));
}
export async function verifyGrant(token: string | undefined) {
  if (!token) return null;
  try {
    return (
      await jwtVerify(token, encoder.encode(secret()), {
        algorithms: ["HS256"],
      })
    ).payload;
  } catch {
    return null;
  }
}
export async function passcodeHash(code: string, salt = secureToken()) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return `${salt}.${Buffer.from(bits).toString("hex")}`;
}
export async function equalSecret(a: string, b: string) {
  const aa = await hashToken(a),
    bb = await hashToken(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++)
    difference |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return difference === 0;
}
export async function verifyPasscode(code: string, hash: string) {
  return equalSecret(await passcodeHash(code, hash.split(".")[0]), hash);
}
async function encryptionKey() {
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", encoder.encode(secret())),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptContent(content: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoder.encode(content),
  );
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(cipher).toString("base64url")}`;
}
export async function decryptContent(content: string) {
  const [iv, cipher] = content.split(".");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
      await encryptionKey(),
      Buffer.from(cipher, "base64url"),
    ),
  );
}
