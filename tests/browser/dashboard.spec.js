import { test, expect } from "@playwright/test";
import { rmSync } from "node:fs";

test("customer → invitation → honest feedback → response → consented widget", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your reputation, in focus." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Full name").fill("Browser Customer");
  await modal.getByLabel("Email address").fill("browser@example.com");
  await modal.getByRole("checkbox").check();
  await modal.getByRole("button", { name: "Create", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByText("Browser Customer", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review requests", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a request", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create invitations" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const snapshot = await (await request.get("/api/bootstrap")).json();
  const invitation = snapshot.requests.find(
    (r) => r.customerName === "Browser Customer",
  );
  expect(invitation).toBeTruthy();
  const publicPage = await context.newPage();
  await publicPage.goto(invitation.path);
  await publicPage
    .getByRole("button", { name: "Rate 2 stars", exact: true })
    .click();
  await publicPage
    .getByLabel("Your name", { exact: true })
    .fill("Browser Reviewer");
  await publicPage
    .getByLabel("Tell us about your experience")
    .fill("The wait was long, but the team was thoughtful and helpful.");
  await publicPage
    .getByText("I agree to have my name and review shown publicly.")
    .click();
  await publicPage.getByRole("button", { name: "Share my experience" }).click();
  await expect(
    publicPage.getByRole("heading", { name: "Thank you for sharing." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reviews", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Browser Reviewer", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reply to review" }).click();
  await page
    .getByLabel("Your response", { exact: true })
    .fill(
      "Thank you for the honest feedback. We are improving our wait times.",
    );
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(
    page.getByText(
      "Thank you for the honest feedback. We are improving our wait times.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Widgets", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a widget", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Widget name")
    .fill("Customer voices");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "grid", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const after = await (await request.get("/api/bootstrap")).json();
  const widget = after.widgets.find((w) => w.name === "Customer voices");
  await publicPage.goto("/embed/" + widget.id);
  await expect(
    publicPage.getByText("Browser Reviewer", { exact: true }),
  ).toBeVisible();
  await publicPage.close();
});
test("Yelp reference keeps excluded reviews separate and reply controls gated", async ({
  page,
  request,
}) => {
  await request.post("/api/sample");
  await page.goto("/reviews");
  await page.getByRole("tab", { name: /Yelp/ }).click();
  await expect(
    page.getByText("Your provider account photo needs verification"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Not recommended (1)" }).click();
  await expect(
    page.getByText(
      "A great first visit. Clear communication made everything easy.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Public comment" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Verify your provider account to respond",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Respond", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Direct message", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Your response" }),
  ).toHaveCount(0);
});
test("all navigation screens render, CSV import handles quotes, settings persist", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const label of [
    "Overview",
    "Reviews",
    "Customers",
    "Review requests",
    "Review pages",
    "Widgets",
    "Messages",
    "Automations",
    "Analytics",
    "Integrations",
    "Settings",
  ]) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await expect(page.locator("main h1")).toBeVisible();
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("TAKATAK Test Studio");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Business name", { exact: true })).toHaveValue(
    "TAKATAK Test Studio",
  );
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV contents")
    .fill(
      'name,email,tags,consent\n"CSV, Customer",csv@example.com,Returning,false',
    );
  await page
    .getByRole("button", { name: "Import customers", exact: true })
    .click();
  await expect(page.getByText("CSV, Customer", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile navigation and overview remain usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your reputation, in focus." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Reviews", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every voice, one view." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/reviews-mobile.png",
    fullPage: true,
  });
});

test("WCAG AA checks pass across cockpit screens, a dialog and the public review form", async ({
  page,
  request,
}) => {
  const { default: axe } = await import("axe-core");
  for (const route of [
    "/",
    "/reviews",
    "/customers",
    "/requests",
    "/pages",
    "/widgets",
    "/messages",
    "/automations",
    "/analytics",
    "/integrations",
    "/settings",
    "/billing",
    "/account",
  ]) {
    await page.goto(route);
    await page.locator("main h1").waitFor();
    await page.evaluate(axe.source);
    const results = await page.evaluate(() =>
      axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }),
    );
    expect(
      results.violations.map((v) => ({
        route,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.goto("/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.evaluate(axe.source);
  const dialog = await page.evaluate(() =>
    axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }),
  );
  expect(
    dialog.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const snapshot = await (await request.get("/api/bootstrap")).json();
  await page.goto("/r/" + snapshot.pages[0].slug);
  await page.getByRole("heading", { name: snapshot.pages[0].title }).waitFor();
  await page.evaluate(axe.source);
  const pub = await page.evaluate(() =>
    axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }),
  );
  expect(
    pub.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("workspace search finds reviews and customers and supports the keyboard shortcut", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Your reputation, in focus." })
    .waitFor();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("textbox", { name: "Search workspace" });
  await expect(search).toBeFocused();
  await search.fill("Browser Reviewer");
  await expect(
    page.getByRole("heading", { name: "Search results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Browser Reviewer.*Review/ }).click();
  await expect(
    page.getByRole("heading", { name: "Browser Reviewer's review" }),
  ).toBeVisible();
});
