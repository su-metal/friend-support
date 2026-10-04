import { test, expect } from "@playwright/test";
for (const width of [375, 390, 430]) {
  test(`主催者作成 → 公開 → 匿名担当 → 主催者確認 → キャンセル (${width}px)`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const viewportName = `mobile-${width}`;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "本当に手伝える形に",
    );
    await page.screenshot({
      path: `output/playwright/landing-${viewportName}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "サポートページを作る", exact: true })
      .click();
    await page.getByRole("button", { name: "デモでページ作成を試す" }).click();
    await page
      .getByLabel("サポートする方のお名前")
      .fill(`確認家族${viewportName}`);
    await page
      .getByLabel("みんなへのひとこと")
      .fill("身近な人と少しずつサポートします。");
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    await page.getByRole("button", { name: "🍱 食事" }).click();
    await page
      .getByLabel("詳しい受け渡し方法・住所")
      .fill("E2E非公開住所101号室");
    await page.getByLabel("アレルギー等の注意").fill("E2E非公開食事注意");
    await page.getByRole("button", { name: "この予定を保存する" }).click();
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    await page.getByRole("button", { name: "下書きを保存して公開へ" }).click();
    await page
      .getByRole("button", { name: "ページを公開する", exact: true })
      .click();
    await expect(
      page.getByText("サポートページを公開しました。", { exact: true }),
    ).toBeVisible();
    const dashboardUrl = page.url();
    const publicUrl = await page
      .getByRole("textbox", { name: "共有リンク" })
      .inputValue();
    const visitorContext = await context
      .browser()!
      .newContext({ viewport: { width, height: 844 } });
    const visitor = await visitorContext.newPage();
    await visitor.goto(publicUrl);
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText(
      "確認家族",
    );
    expect(await visitor.locator("body").innerText()).not.toContain(
      "E2E非公開",
    );
    const response = await visitor.request.get(
      publicUrl.replace("/s/", "/api/support/"),
    );
    const publicData = await response.json();
    expect(JSON.stringify(publicData)).not.toContain("privateInstructions");
    expect(JSON.stringify(publicData)).not.toContain("E2E非公開");
    await visitor.screenshot({
      path: `output/playwright/support-${viewportName}.png`,
      fullPage: true,
    });
    expect(
      await visitor.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await visitor.getByRole("button", { name: "私が担当する" }).click();
    expect(
      await visitor.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
    await visitor.keyboard.press("Escape");
    await expect(visitor.getByRole("dialog")).toHaveCount(0);
    await visitor.getByRole("button", { name: "私が担当する" }).click();
    await visitor.getByLabel("お名前", { exact: true }).fill("E2E支援者");
    await visitor.getByLabel("ひとこと").fill("主催者にだけ伝える内容");
    await visitor
      .getByRole("button", { name: "この予定を担当する", exact: true })
      .click();
    await expect(
      visitor.getByRole("heading", { name: "担当が決まりました！" }),
    ).toBeVisible();
    await expect(
      visitor.getByText("E2E非公開住所101号室", { exact: true }),
    ).toBeVisible();
    await expect(
      visitor.getByText("E2E非公開食事注意", { exact: true }),
    ).toBeVisible();
    await page.goto(dashboardUrl);
    await expect(
      page.getByText("E2E支援者さん", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("主催者にだけ伝える内容", { exact: true }),
    ).toBeVisible();
    await visitor
      .getByRole("button", { name: "担当をキャンセルする", exact: true })
      .click();
    await visitor
      .getByRole("button", { name: "担当をキャンセル", exact: true })
      .click();
    await expect(
      visitor.getByRole("heading", { name: "担当をキャンセルしました" }),
    ).toBeVisible();
    expect(await visitor.locator("body").innerText()).not.toContain(
      "E2E非公開",
    );
    await page.goto(dashboardUrl);
    await expect(
      page.locator(".organizer-slot").getByText("募集中", { exact: true }),
    ).toBeVisible();
    // APIも同じ1枠で競合する。ブラウザー内の同一オリジンfetchを使用。
    const endpoint =
      new URL(publicUrl).pathname.replace("/s/", "/api/support/") + "/assign";
    const statuses = await visitor.evaluate(
      async ({ endpoint, slotId }) =>
        Promise.all(
          ["競合A", "競合B"].map(
            async (name) =>
              (
                await fetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ slotId, supporterName: name }),
                })
              ).status,
          ),
        ),
      { endpoint, slotId: publicData.slots[0].id },
    );
    expect(statuses.sort()).toEqual([201, 409]);
    expect(errors).toEqual([]);
    await visitorContext.close();
  });
}
test("公開APIのCSRFと認証を拒否する", async ({ request }) => {
  const response = await request.post("/api/pages", { data: {} });
  expect(response.status()).toBe(403);
  const auth = await request.post("/api/pages", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {},
  });
  expect(auth.status()).toBe(401);
  const cron = await request.get("/api/jobs");
  expect(cron.status()).toBe(401);
});

test("公開支援ガイドは375/390/430pxで表示し、サイトマップに掲載する", async ({
  page,
  request,
}) => {
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/guides/coordinate-support");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "生活支援を、無理のない予定にする7つの手順",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(new URL(canonical!, page.url()).pathname).toBe(
      "/guides/coordinate-support",
    );
    const headHtml = (await page.locator("head").innerHTML()).toLowerCase();
    expect(headHtml).not.toContain("noindex");
    await page.screenshot({
      path: `output/playwright/guide-${width}.png`,
      fullPage: true,
    });
  }

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBe(true);
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("/guides/coordinate-support");
  expect(sitemap).not.toContain("/demo");
  expect(sitemap).not.toContain("/s/");

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.ok()).toBe(true);
  const robots = await robotsResponse.text();
  expect(robots).toContain("/sitemap.xml");
  expect(robots).toContain("/s/");

  await page.goto("/guides");
  await expect(
    page.getByRole("link", { name: /身近な人への手助けを/ }),
  ).toBeVisible();
});
