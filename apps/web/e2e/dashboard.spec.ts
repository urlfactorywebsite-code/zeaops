import { expect, test } from "@playwright/test";

test("dashboard connects to the actual local API and database", async ({ page, request }) => {
  const health = await request.get("/api/health/ready");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ready", service: "zeaops-api" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Infrastructure overview" })).toBeVisible();
  await expect(page.getByText("Your control plane is ready")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("navigation and preferences work at each viewport", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    expect(
      await page.locator(".main-wrap").evaluate((element) => element.hasAttribute("inert")),
    ).toBe(true);
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toHaveCount(0);
    expect(
      await page.locator(".main-wrap").evaluate((element) => element.hasAttribute("inert")),
    ).toBe(false);
    await page.setViewportSize(viewport!);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Servers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Servers workspace" })).toBeVisible();
  await expect(page.getByText("No servers are connected", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Back to overview" }).click();
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Display preferences" }).click();
  await page.getByLabel("Health refresh interval").selectOption("60");
  await page.getByRole("button", { name: "Apply preference" }).click();
  await expect(page.getByRole("status")).toContainText("Preference applied");
});

test("reduced motion and keyboard navigation are supported", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(
    await page
      .locator(".module-card")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

test("unavailable upstream is clearly reported without invented health", async ({ page }) => {
  // Failure presentation test; the connectivity test above uses actual services.
  await page.route("**/api/health/*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "not_ready",
          message: "Metadata database is not ready",
          correlation_id: "browser-test",
        },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Local services need attention")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Your control plane is ready")).toHaveCount(0);
});
