const { test, expect } = require("@playwright/test");

test("boot Agent RH sans erreur JavaScript", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push("console: " + message.text());
  });

  await page.goto("/rh/");
  await page.locator("#sessRole").selectOption("agent");
  await expect(page.locator("#pageTitle")).toHaveText("Accueil");
  await page.waitForTimeout(100);

  expect(errors, errors.join("\n")).toEqual([]);
});
