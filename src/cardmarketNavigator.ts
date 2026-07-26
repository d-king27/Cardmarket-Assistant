import type { Locator, Page } from "@playwright/test";

import { resolveExpansionOption } from "./expansionResolver.js";
import type { CardmarketPageContext, SetBatch } from "./types.js";

export const BULK_LISTING_SELECTOR = "div#BulkAccordion";

function expansionSelect(page: Page): Locator {
  return page.getByLabel("Expansion", { exact: true }).or(
    page.locator("label", { hasText: /^Expansion$/i }).locator("xpath=following::select[1]"),
  ).first();
}

function sortSelect(page: Page): Locator {
  return page.getByLabel("Sort by", { exact: true }).or(
    page.locator("label", { hasText: /^Sort by$/i }).locator("xpath=following::select[1]"),
  ).first();
}

function raritySelect(page: Page): Locator {
  return page.getByLabel("Rarity", { exact: true }).or(
    page.locator("label", { hasText: /^Rarity$/i }).locator("xpath=following::select[1]"),
  ).first();
}

function filterButton(page: Page): Locator {
  return page.getByRole("button", { name: /^FILTER$/i }).or(
    page.locator('input[type="submit"][value="FILTER" i]'),
  ).first();
}

function normalizeOption(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

async function selectExactOption(
  select: Locator,
  requestedLabel: string,
  description: string,
): Promise<string> {
  const options = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: (node.textContent ?? "").trim(),
      value: (node as HTMLOptionElement).value,
    })),
  );
  const requested = normalizeOption(requestedLabel);
  const matches = options.filter(
    (option) => normalizeOption(option.label) === requested,
  );

  if (matches.length !== 1) {
    throw new Error(
      `No unambiguous Cardmarket ${description} option matched ${requestedLabel}. Refusing to guess.`,
    );
  }

  await select.selectOption(matches[0]!.value);
  return matches[0]!.label;
}

export function importCsvButton(page: Page): Locator {
  return page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /IMPORT CSV/i })
    .or(page.getByText(/^IMPORT CSV(?:…|\.\.\.)?$/i))
    .first();
}

async function readHitCount(page: Page): Promise<number | undefined> {
  const text = await page
    .getByText(/\d+\s+Hits/i)
    .first()
    .textContent()
    .catch(() => null);
  const match = text?.match(/(\d+)\s+Hits/i);
  return match === null || match === undefined ? undefined : Number(match[1]);
}

export async function prepareCardmarketSetPage(
  page: Page,
  set: SetBatch,
  rarity?: string,
): Promise<CardmarketPageContext> {
  await page.getByRole("heading", { name: "Bulk List Cards" }).waitFor({
    state: "visible",
    timeout: 20_000,
  });

  const expansion = expansionSelect(page);
  await expansion.waitFor({ state: "visible", timeout: 20_000 });
  const options = await expansion.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: (node.textContent ?? "").trim(),
      value: (node as HTMLOptionElement).value,
    })),
  );
  const resolved = await resolveExpansionOption(options, set);

  await expansion.selectOption(resolved.value);

  if (rarity !== undefined) {
    const rarityControl = raritySelect(page);
    await rarityControl.waitFor({ state: "visible", timeout: 20_000 });
    await selectExactOption(rarityControl, rarity, "rarity");
  }

  const sort = sortSelect(page);
  if (await sort.isVisible().catch(() => false)) {
    const collectorOption = sort
      .locator("option")
      .filter({ hasText: /^Collectors? Number$/i })
      .first();

    if ((await collectorOption.count()) > 0) {
      await sort.selectOption(await collectorOption.getAttribute("value") ?? {
        label: await collectorOption.textContent() ?? "",
      });
    }
  }

  const navigation = page
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 5_000 })
    .catch(() => null);
  await filterButton(page).click();
  await navigation;

  await page.locator(BULK_LISTING_SELECTOR).waitFor({
    state: "attached",
    timeout: 20_000,
  });
  const importButton = importCsvButton(page);
  const extensionUiPresent = await importButton
    .isVisible()
    .catch(() => false);
  const resultsTablePresent =
    (await page.getByRole("columnheader", { name: "Name" }).count()) > 0;
  const hitCount = await readHitCount(page);

  return {
    url: page.url(),
    title: await page.title(),
    bulkListingPresent: true,
    extensionUiPresent,
    expansionLabel: resolved.label,
    expansionValue: resolved.value,
    ...(hitCount === undefined ? {} : { hitCount }),
    resultsTablePresent,
    capturedAt: new Date().toISOString(),
  };
}

export async function openCardmarketSetPage(
  page: Page,
  url: string,
  set: SetBatch,
  rarity?: string,
): Promise<CardmarketPageContext> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return prepareCardmarketSetPage(page, set, rarity);
}
