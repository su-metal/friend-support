import { importPKCS8, SignJWT } from "jose";
export async function googleAccessToken() {
  const email = process.env.FIREBASE_CLIENT_EMAIL,
    pem = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !pem)
    throw new Error("Firebaseサービスアカウントを設定してください");
  const assertion = await new SignJWT({
    scope:
      "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(await importPKCS8(pem, "RS256"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Firebase認証に失敗しました");
  return ((await response.json()) as { access_token: string }).access_token;
}
