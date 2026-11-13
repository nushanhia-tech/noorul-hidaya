import { expect, test, type Page } from "@playwright/test";

/**
 * Authenticated end-to-end workflows against a real Supabase project seeded
 * with `npm run seed`. Enable with E2E_SUPABASE=1 and SEED_PASSWORD set to
 * the password used when seeding.
 */
const enabled = process.env.E2E_SUPABASE === "1" && Boolean(process.env.SEED_PASSWORD);
test.skip(!enabled, "Set E2E_SUPABASE=1 and SEED_PASSWORD to run authenticated workflows");

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("student signs in, sees only the student portal, and signs out", async ({ page }) => {
  await signIn(page, "student1@demo.college.test");
  await expect(page).toHaveURL(/\/portal\/student/);
  await page.goto("/portal/admin");
  await expect(page).toHaveURL(/\/forbidden/);
  await page.goto("/portal/student");
  await page.getByRole("button", { name: "Sign out" }).first().click({ force: true });
  await expect(page).toHaveURL(/\/login\?signed_out=1/);
  await page.goto("/portal/student");
  await expect(page).toHaveURL(/\/login/);
});

test("student raises a help desk ticket that the office can see", async ({ page, browser }) => {
  await signIn(page, "student1@demo.college.test");
  await page.goto("/portal/student/helpdesk/new");
  await page.getByLabel("Category").selectOption("receipt_request");
  const subject = `Receipt copy ${Date.now()}`;
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel("Description").fill("Please send a copy of my semester fee receipt.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();

  const office = await browser.newPage();
  await signIn(office, "superintendent@demo.college.test");
  await office.goto(`/portal/office/helpdesk?q=${encodeURIComponent(subject)}`);
  await expect(office.getByText(subject).first()).toBeVisible();
});
