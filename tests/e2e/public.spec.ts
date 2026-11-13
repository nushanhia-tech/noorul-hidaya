import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("homepage renders the hero and quick links without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name: "Programmes" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  for (const path of ["/about", "/departments", "/programmes", "/faculty", "/calendar", "/news", "/events", "/gallery", "/contact"]) {
    test(`${path} loads`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("contact form validates required fields in the browser", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    const valid = await page.locator("#name").evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });
});

test.describe("responsive navigation", () => {
  test("mobile menu opens, lists sections and closes with Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/");
    await page.getByTestId("mobile-menu-button").click();
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Departments" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("desktop shows the two-tier header with portal login", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop only");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Portal Login/ }).first()).toBeVisible();
  });
});

test.describe("authentication guards", () => {
  for (const portal of ["student", "faculty", "parent", "admin", "office"]) {
    test(`/portal/${portal} is not reachable without signing in`, async ({ page }) => {
      await page.goto(`/portal/${portal}`);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("login form validates input and toggles password visibility", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address")).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill("secret");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  });
});
