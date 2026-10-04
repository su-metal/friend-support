export function appUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}
export function isDemoMode() {
  return (
    process.env.APP_MODE === "demo" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(appUrl()).hostname)
  );
}
export function secret() {
  const value = process.env.APP_SECRET;
  if (value && value.length >= 32) return value;
  if (isDemoMode()) return "local-only-demo-secret-never-for-production";
  throw new Error("APP_SECRETを設定してください");
}
export function firebaseProjectId() {
  const id = process.env.FIREBASE_PROJECT_ID;
  if (!id) throw new Error("Firebaseの接続設定が必要です");
  return id;
}
