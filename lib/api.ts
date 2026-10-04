import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { appUrl, isDemoMode, secret } from "./env";
import { hashToken, verifyGrant } from "./security";
import { getStore } from "@/services/factory";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("content_type", "入力形式が正しくありません", 415);
  if (Number(request.headers.get("content-length") || 0) > 100000)
    throw new AppError("size", "入力が長すぎます", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("body", "入力を確認してください");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 100000) {
      await reader.cancel();
      throw new AppError("size", "入力が長すぎます", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("body", "入力を確認してください");
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(appUrl()).origin)
    throw new AppError("origin", "この操作をやり直してください", 403);
}
export async function rateLimit(request: Request, action: string, limit = 12) {
  const ip = isDemoMode()
    ? "local"
    : request.headers.get("cf-connecting-ip") || "unknown";
  const hash = await hashToken(
      `${secret()}:${ip}:${action}:${Math.floor(Date.now() / 600000)}`,
    ),
    store = await getStore();
  await store.transaction(async (tx) => {
    const old = await tx.get<{ count: number }>(`rate_limit_buckets/${hash}`);
    if ((old?.count ?? 0) >= limit)
      throw new AppError(
        "rate_limit",
        "少し時間をおいてからお試しください",
        429,
      );
    tx.set(`rate_limit_buckets/${hash}`, {
      id: hash,
      count: (old?.count ?? 0) + 1,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
  });
}
export async function pageAccessVersion(slug: string) {
  const grant = await verifyGrant(
    (await cookies()).get(`support-access-${slug}`)?.value,
  );
  return grant?.purpose === "page-access" &&
    grant.slug === slug &&
    typeof grant.version === "string"
    ? grant.version
    : undefined;
}
export async function api(work: () => Promise<NextResponse>) {
  try {
    return await work();
  } catch (e) {
    if (e instanceof AppError)
      return json({ error: e.message, code: e.code }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error: e.issues[0]?.message ?? "入力を確認してください",
          code: "validation",
        },
        400,
      );
    return json(
      {
        error: "処理できませんでした。時間をおいてお試しください",
        code: "server",
      },
      503,
    );
  }
}
