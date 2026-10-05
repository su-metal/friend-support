import { test, expect, type Page } from "@playwright/test";
async function noHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
for (const width of [375, 390, 430]) {
  test(`ご本人用リンク → お願い → LINEで知らせる → お休み (${width}px)`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const name = `mobile-${width}`;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/create");
    await page.getByRole("button", { name: "デモでページ作成を試す" }).click();
    await page.getByLabel("サポートする方のお名前").fill(`本人確認${name}`);
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    await page.getByRole("button", { name: "🍱 食事" }).click();
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
    await page.getByRole("button", { name: "ご本人用リンクを作る" }).click();
    const recipientUrl = await page
      .getByRole("textbox", { name: "ご本人用リンク" })
      .inputValue();
    expect(recipientUrl).toContain("/r/");
    await page.screenshot({
      path: `output/playwright/recipient-dashboard-${name}.png`,
      fullPage: true,
    });
    await noHorizontalScroll(page);

    const recipientContext = await context
      .browser()!
      .newContext({ viewport: { width, height: 844 } });
    const recipient = await recipientContext.newPage();
    await recipient.goto(recipientUrl);
    await expect(recipient.getByRole("heading", { level: 1 })).toContainText(
      "困ったときはここから",
    );
    await recipient.screenshot({
      path: `output/playwright/recipient-home-${name}.png`,
      fullPage: true,
    });
    await noHorizontalScroll(recipient);
    await recipient.getByRole("button", { name: /おむつ・日用品/ }).click();
    await expect(recipient.getByLabel("みんなに見える予定名")).toHaveValue(
      "日用品を買って届ける",
    );
    await recipient
      .getByLabel("ひとこと（みんなに見えます・なくてもOK）")
      .fill("夕方までに");
    await recipient
      .getByLabel("伝えたいこと（なくてもOK）")
      .fill("E2E本人非公開メモ");
    await recipient.screenshot({
      path: `output/playwright/recipient-form-${name}.png`,
      fullPage: true,
    });
    await noHorizontalScroll(recipient);
    await recipient.getByRole("button", { name: "このお願いを出す" }).click();
    await expect(
      recipient.getByRole("heading", { name: "お願いを出しました" }),
    ).toBeVisible();
    const lineHref = await recipient
      .getByRole("link", { name: "LINEで知らせる" })
      .getAttribute("href");
    expect(decodeURIComponent(lineHref!)).toContain("日用品を買って届ける");
    expect(decodeURIComponent(lineHref!)).toContain(
      new URL(publicUrl).pathname,
    );
    expect(decodeURIComponent(lineHref!)).not.toContain("E2E本人非公開");
    await recipient.screenshot({
      path: `output/playwright/recipient-done-${name}.png`,
      fullPage: true,
    });
    await noHorizontalScroll(recipient);

    const visitorContext = await context
      .browser()!
      .newContext({ viewport: { width, height: 844 } });
    const visitor = await visitorContext.newPage();
    await visitor.goto(publicUrl);
    await expect(
      visitor.getByRole("heading", { name: "日用品を買って届ける" }),
    ).toBeVisible();
    expect(await visitor.locator("body").innerText()).not.toContain(
      "E2E本人非公開",
    );
    const api = await visitor.request.get(
      publicUrl.replace("/s/", "/api/support/"),
    );
    expect(JSON.stringify(await api.json())).not.toContain("E2E本人非公開");

    await recipient
      .getByRole("button", { name: "ご本人用ページにもどる" })
      .click();
    await recipient.getByRole("button", { name: "受付をお休みにする" }).click();
    await expect(
      recipient.getByRole("button", { name: "受付を再開する" }),
    ).toBeVisible();
    await visitor.reload();
    await expect(
      visitor.getByText("ただいまお休み中です").first(),
    ).toBeVisible();
    await expect(
      visitor.getByRole("button", { name: "私が担当する" }),
    ).toHaveCount(0);
    await visitor.screenshot({
      path: `output/playwright/recipient-paused-public-${name}.png`,
      fullPage: true,
    });
    await noHorizontalScroll(visitor);

    await page.goto(dashboardUrl);
    await expect(
      page.getByText("ご本人のお願い", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "無効にする" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "無効にする" })
      .click();
    await expect(page.getByText("未発行", { exact: true })).toBeVisible();
    const gone = await recipient.goto(recipientUrl);
    expect(gone?.status()).toBe(404);
    expect(errors).toEqual([]);
    await recipientContext.close();
    await visitorContext.close();
  });
}
