// Recherche par saisie dans les listes déroulantes (shared/select-search.js), commune à tous
// les modules : une liste native <select> de plus de 6 options reçoit un champ de recherche
// devant elle qui filtre ses <option> en direct ; une liste courte n'en reçoit pas ; le
// <select> lui-même reste inchangé (même id, mêmes valeurs), donc toujours pilotable par
// page.selectOption comme avant cette fonctionnalité.
const { test, expect } = require("@playwright/test");

test.describe("Recherche dans les listes déroulantes — module Achats", () => {
  test("une liste longue (Fournisseur) reçoit un champ de recherche qui filtre les options (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");

    const search = page.locator("#tiersSelect").locator("xpath=preceding-sibling::input[1]");
    await expect(search).toHaveClass(/select-search-input/);

    const optionCountBefore = await page.locator("#tiersSelect option").count();
    expect(optionCountBefore).toBeGreaterThan(6);

    await search.fill("Fenua");
    const visibleOptions = await page.locator("#tiersSelect option:not([hidden])").allTextContents();
    expect(visibleOptions.length).toBeLessThan(optionCountBefore);
    expect(visibleOptions.every((t) => t.includes("Fenua"))).toBe(true);

    // La sélection par valeur continue de fonctionner normalement (page.selectOption).
    const value = await page.locator("#tiersSelect option", { hasText: "Fenua" }).getAttribute("value");
    await page.selectOption("#tiersSelect", value);
    await expect(page.locator("#tiersSelect")).toHaveValue(value);
  });

  test("une liste courte (Type de ligne) ne reçoit pas de champ de recherche (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");

    const typeSelect = page.locator('select[data-f="type"]').first();
    await expect(typeSelect).toBeVisible();
    const optionCount = await typeSelect.locator("option").count();
    expect(optionCount).toBeLessThanOrEqual(6);
    const prevTag = await typeSelect.evaluate((el) => el.previousElementSibling && el.previousElementSibling.tagName);
    expect(prevTag).not.toBe("INPUT");
  });

  test("vider la recherche réaffiche toutes les options (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    const search = page.locator("#tiersSelect").locator("xpath=preceding-sibling::input[1]");
    const total = await page.locator("#tiersSelect option").count();
    await search.fill("Fenua");
    await expect(page.locator("#tiersSelect option:not([hidden])")).toHaveCount(1);
    await search.fill("");
    await expect(page.locator("#tiersSelect option:not([hidden])")).toHaveCount(total);
  });
});

test.describe("Recherche dans les listes déroulantes — modules RH et Logement", () => {
  test("RH : la liste Agent (formulaire Formations) reçoit un champ de recherche (cas nominal)", async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Formations" }).click();
    await page.click("#addBtn");
    const agentSelect = page.locator('select[data-k="agentId"]');
    const search = agentSelect.locator("xpath=preceding-sibling::input[1]");
    await expect(search).toHaveClass(/select-search-input/);
    await search.fill("TETUANUI");
    const visible = await agentSelect.locator("option:not([hidden])").allTextContents();
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((t) => t.toUpperCase().includes("TETUANUI"))).toBe(true);
  });

  test("Logement : la liste Lotissement (formulaire Logement) reçoit un champ de recherche (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("#nav a", { hasText: "Logements & stationnements" }).click();
    await page.click("#addBtn");
    const lotissementSelect = page.locator('select[data-k="lotissementId"]');
    await expect(lotissementSelect).toBeVisible();
    const count = await lotissementSelect.locator("option").count();
    if (count > 6) {
      const search = lotissementSelect.locator("xpath=preceding-sibling::input[1]");
      await expect(search).toHaveClass(/select-search-input/);
    }
  });
});
