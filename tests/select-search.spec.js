// Recherche par saisie dans les listes déroulantes (shared/select-search.js), commune à tous
// les modules : une liste native <select> de plus de 6 options reçoit un champ de recherche
// devant elle, qui fait apparaître une liste de suggestions cliquables (plutôt que de masquer
// les <option>, ce qui laissait un <select> fermé afficher une valeur sélectionnée trompeuse —
// bug constaté sur mobile). Choisir une suggestion met à jour le <select> lui-même (même id,
// même valeur, évènement "change" déclenché), donc toujours pilotable par page.selectOption().
const { test, expect } = require("@playwright/test");

test.describe("Recherche dans les listes déroulantes — module Achats", () => {
  test("une liste longue (Fournisseur) propose des suggestions qui mettent à jour la sélection (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");

    const wrap = page.locator("#tiersSelect").locator("xpath=preceding-sibling::div[contains(@class,'select-search-wrap')]");
    const search = wrap.locator(".select-search-input");
    await expect(search).toBeVisible();

    const optionCount = await page.locator("#tiersSelect option").count();
    expect(optionCount).toBeGreaterThan(6);

    await search.fill("Fenua");
    const items = wrap.locator(".select-search-item");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveText("Fenua Informatique");

    const expectedValue = await page.locator("#tiersSelect option", { hasText: "Fenua Informatique" }).getAttribute("value");
    await items.first().click();
    await expect(page.locator("#tiersSelect")).toHaveValue(expectedValue);
    // La liste se referme et le select natif reflète bien le choix (plus de valeur "fantôme").
    await expect(items).toHaveCount(0);

    // page.selectOption reste utilisable normalement sur le même <select>.
    await page.selectOption("#tiersSelect", { index: 0 });
    await expect(page.locator("#tiersSelect")).not.toHaveValue(expectedValue);
  });

  test("le champ affiche déjà la sélection en cours à l'ouverture d'un formulaire d'édition (cas nominal)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.locator("tbody tr", { hasText: "Fournitures de bureau" }).locator("[data-edit]").click();
    const wrap = page.locator("#tiersSelect").locator("xpath=preceding-sibling::div[contains(@class,'select-search-wrap')]");
    await expect(wrap.locator(".select-search-input")).toHaveValue("SOPAD Polynésie");
    // Masqué visuellement (opacité 0) pour ne pas afficher deux listes qui se contredisent,
    // mais toujours présent et actionnable (page.selectOption continue de fonctionner ailleurs).
    await expect(page.locator("#tiersSelect")).toHaveCSS("opacity", "0");
  });

  test("une recherche sans résultat affiche un message plutôt qu'une liste vide (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");
    const wrap = page.locator("#tiersSelect").locator("xpath=preceding-sibling::div[contains(@class,'select-search-wrap')]");
    await wrap.locator(".select-search-input").fill("zzzzz-inexistant");
    await expect(wrap.locator(".select-search-item")).toHaveCount(0);
    await expect(wrap.locator("text=Aucun résultat")).toBeVisible();
  });

  test("une liste courte (Type de ligne) ne reçoit pas de champ de recherche (cas limite)", async ({ page }) => {
    await page.goto("/achats/");
    await page.locator("[data-nav='commandes']").click();
    await page.click("#addBtn");

    const typeSelect = page.locator('select[data-f="type"]').first();
    await expect(typeSelect).toBeVisible();
    const optionCount = await typeSelect.locator("option").count();
    expect(optionCount).toBeLessThanOrEqual(6);
    const prevClass = await typeSelect.evaluate((el) => el.previousElementSibling && el.previousElementSibling.className);
    expect(prevClass || "").not.toContain("select-search-wrap");
  });
});

test.describe("Recherche dans les listes déroulantes — modules RH et Logement", () => {
  test("RH : la liste Agent (formulaire Formations) propose des suggestions filtrées (cas nominal)", async ({ page }) => {
    await page.goto("/rh/");
    await page.locator("#nav a", { hasText: "Formations" }).click();
    await page.click("#addBtn");
    const agentSelect = page.locator('select[data-k="agentId"]');
    const wrap = agentSelect.locator("xpath=preceding-sibling::div[contains(@class,'select-search-wrap')]");
    await wrap.locator(".select-search-input").fill("TETUANUI");
    const items = wrap.locator(".select-search-item");
    await expect(items.first()).toBeVisible();
    const texts = await items.allTextContents();
    expect(texts.every((t) => t.toUpperCase().includes("TETUANUI"))).toBe(true);

    const expectedValue = await agentSelect.locator("option", { hasText: texts[0] }).first().getAttribute("value");
    await items.first().click();
    await expect(agentSelect).toHaveValue(expectedValue);
  });

  test("Logement : la liste Lotissement (formulaire Logement) reçoit la recherche si elle est assez longue (cas nominal)", async ({ page }) => {
    await page.goto("/logement/");
    await page.locator("#nav a", { hasText: "Logements & stationnements" }).click();
    await page.click("#addBtn");
    const lotissementSelect = page.locator('select[data-k="lotissementId"]');
    await expect(lotissementSelect).toBeVisible();
    const count = await lotissementSelect.locator("option").count();
    if (count > 6) {
      const wrap = lotissementSelect.locator("xpath=preceding-sibling::div[contains(@class,'select-search-wrap')]");
      await expect(wrap.locator(".select-search-input")).toBeVisible();
    }
  });
});
