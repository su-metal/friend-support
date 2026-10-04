import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const auth = require("firebase-tools/lib/auth.js");
const account = auth.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error("Firebase CLIへのログインが必要です");
const { access_token: adminToken } = await auth.getAccessToken(
  account.tokens.refresh_token,
  [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ],
);
const project = "support-circle-31a09";
const origin = "https://friend-support.tossy104104.workers.dev";
const email = `acceptance-${Date.now()}@example.invalid`;
const secrets = JSON.parse(await readFile(".secrets/cloudflare.json", "utf8"));
async function google(url, body, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(`Google verification request failed (${response.status})`);
  return response.status === 204 ? {} : response.json();
}
const browser = await chromium.launch();
let userId,
  pageId,
  page,
  failure = false;
const report = { origin, emailSent: false, checks: [], widths: [] };
await mkdir("output/playwright", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const response = await page.goto(origin);
    assert.equal(response.status(), 200);
    assert.match(await page.locator("h1").innerText(), /本当に手伝える形に/);
    assert.equal(
      await page.getByText("ローカルデモ", { exact: false }).count(),
      0,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `output/playwright/production-landing-${width}.png`,
      fullPage: true,
    });
    report.widths.push(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const generated = await google(
    "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode",
    {
      requestType: "EMAIL_SIGNIN",
      email,
      targetProjectId: project,
      returnOobLink: true,
      continueUrl: `${origin}/auth/complete`,
      canHandleCodeInApp: true,
    },
  );
  // OAuth管理APIでリンクだけを取得。メールは送信しない。
  await page.goto(generated.oobLink);
  await page.waitForURL(
    (url) => url.origin === origin && url.pathname === "/auth/complete",
    { timeout: 30000 },
  );
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await page.waitForURL(`${origin}/create`, { timeout: 30000 });
  const lookup = await google(
    `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
    { email: [email] },
  );
  userId = lookup.users?.[0]?.localId;
  assert(userId);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "friend-support-session",
  );
  assert(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Lax");
  report.checks.push("real_email_link_login_and_secure_session");
  await page
    .getByLabel("サポートする方のお名前")
    .fill("公開確認用サンプル家族");
  await page
    .getByLabel("みんなへのひとこと")
    .fill("動作確認用です。実際の支援募集ではありません。");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.getByRole("button", { name: "🍱 食事" }).click();
  await page
    .getByLabel("詳しい受け渡し方法・住所")
    .fill("公開確認用非公開案内101号室");
  await page.getByLabel("アレルギー等の注意").fill("公開確認用非公開食事注意");
  await page.getByRole("button", { name: "この予定を保存する" }).click();
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.getByLabel("ページにパスコードを設定する").check();
  await page.getByLabel("4〜8桁の数字", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "下書きを保存して公開へ" }).click();
  const publishing = page.waitForResponse(
    (r) => r.url().includes("/api/pages/") && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "ページを公開する", exact: true })
    .click();
  assert.equal((await publishing).status(), 200);
  await page
    .getByText("サポートページを公開しました。", { exact: true })
    .waitFor();
  pageId = new URL(page.url()).pathname.split("/").pop();
  const publicUrl = await page
    .getByRole("textbox", { name: "共有リンク" })
    .inputValue();
  const visitorContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const visitor = await visitorContext.newPage();
  await visitor.goto(publicUrl);
  assert(
    !(await visitor.locator("body").innerText()).includes(
      "公開確認用サンプル家族",
    ),
  );
  const denied = await visitor.request.get(
    publicUrl.replace("/s/", "/api/support/"),
  );
  assert.equal(denied.status(), 403);
  const passcodeInput = visitor.locator('input[type="password"]');
  await passcodeInput.fill("1234");
  await visitor
    .getByRole("button", { name: "ページを開く", exact: true })
    .click();
  await visitor
    .getByRole("heading", { level: 1 })
    .filter({ hasText: "公開確認用サンプル家族" })
    .waitFor();
  const publicResponse = await visitor.request.get(
    publicUrl.replace("/s/", "/api/support/"),
  );
  assert.equal(publicResponse.status(), 200);
  assert.match(publicResponse.headers()["x-robots-tag"], /noindex/);
  assert.match(publicResponse.headers()["cache-control"], /no-store/);
  const publicData = await publicResponse.json();
  assert(!JSON.stringify(publicData).includes("非公開"));
  assert(!JSON.stringify(publicData).includes(email));
  for (const width of [375, 390, 430]) {
    await visitor.setViewportSize({ width, height: 844 });
    assert(
      await visitor.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await visitor.screenshot({
      path: `output/playwright/production-support-${width}.png`,
      fullPage: true,
    });
  }
  report.checks.push("production_create_publish_passcode_privacy_mobile");
  await visitor
    .getByRole("button", { name: "私が担当する", exact: true })
    .click();
  await visitor.getByLabel("お名前", { exact: true }).fill("公開確認支援者");
  await visitor
    .getByLabel("ひとこと", { exact: false })
    .fill("主催者だけへの確認メッセージ");
  await visitor
    .getByRole("button", { name: "この予定を担当する", exact: true })
    .click();
  await visitor
    .getByRole("heading", { name: "担当が決まりました！" })
    .waitFor();
  await visitor
    .getByText("公開確認用非公開案内101号室", { exact: true })
    .waitFor();
  await page.reload();
  await page.getByText("公開確認支援者さん", { exact: true }).waitFor();
  await page
    .getByText("主催者だけへの確認メッセージ", { exact: true })
    .waitFor();
  await visitor
    .getByRole("button", { name: "担当をキャンセルする", exact: true })
    .click();
  await visitor
    .getByRole("button", { name: "担当をキャンセル", exact: true })
    .click();
  await visitor
    .getByRole("heading", { name: "担当をキャンセルしました" })
    .waitFor();
  assert(
    !(await visitor.locator("body").innerText()).includes("公開確認用非公開"),
  );
  const endpoint =
    new URL(publicUrl).pathname.replace("/s/", "/api/support/") + "/assign";
  const statuses = await visitor.evaluate(
    async ({ endpoint, slotId }) =>
      Promise.all(
        ["確認競合A", "確認競合B"].map(
          async (supporterName) =>
            (
              await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slotId, supporterName }),
              })
            ).status,
        ),
      ),
    { endpoint, slotId: publicData.slots[0].id },
  );
  assert.deepEqual(statuses.sort(), [201, 409]);
  report.checks.push("production_assign_organizer_check_cancel_race");
  const jobs = await fetch(`${origin}/api/jobs`, {
    headers: { Authorization: `Bearer ${secrets.CRON_SECRET}` },
  });
  assert.equal(jobs.status, 200);
  report.jobs = await jobs.json();
  const deletion = await page.evaluate(
    async (id) =>
      (
        await fetch(`/api/pages/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        })
      ).status,
    pageId,
  );
  assert.equal(deletion, 200);
  assert.equal((await visitor.request.get(publicUrl)).status(), 404);
  pageId = undefined;
  await visitorContext.close();
  assert.deepEqual(browserErrors, []);
  report.checks.push("cron_authenticated_and_personal_data_deleted");
} catch (error) {
  failure = true;
  report.error = String(error.message)
    .split("\n")[0]
    .replace(/https:\/\/\S+/g, "<url>");
  if (page)
    await page
      .screenshot({
        path: "output/playwright/production-failure.png",
        fullPage: true,
      })
      .catch(() => {});
} finally {
  if (!userId) {
    const lookup = await google(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
      { email: [email] },
    );
    userId = lookup.users?.[0]?.localId;
  }
  if (userId) {
    // 失敗時も、この確認で作ったアカウントと関連データだけを清掃する。
    const { SupportService } = await import("../services/support.ts");
    const { FirestoreRestStore } =
      await import("../lib/firebase/firestore-rest.ts");
    Object.assign(process.env, secrets, {
      FIREBASE_PROJECT_ID: project,
      APP_URL: origin,
      APP_MODE: "firebase",
    });
    const store = new FirestoreRestStore();
    const service = new SupportService(store);
    const pages = await store.query("support_pages", [
      { field: "organizerId", value: userId },
    ]);
    for (const p of pages) await service.remove({ id: userId, email }, p.id);
    await store.transaction(async (tx) => tx.delete(`profiles/${userId}`));
    await google(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`,
      { localId: userId },
    );
  }
  await browser.close();
  await writeFile(
    "output/production-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
process.exit(failure ? 1 : 0);
