import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { loadBatch } from "./batchLoader.js";
import { prepareCardmarketSetPage } from "./cardmarketNavigator.js";
import { stageSetCsv } from "./csvStager.js";
import { CardmarketCsvImportBridge } from "./extensionBridge.js";
import { selectSetBatch } from "./setPlanner.js";
import type { ProcessingPlan, ProcessingPlanItem } from "./queueTypes.js";
import type {
  CardmarketPageContext,
  ImportPreviewDiagnostics,
} from "./types.js";

const BULK_LISTING_PATH = /\/Stock\/ListingMethods\/BulkListing/i;

export function selectDemoItem(plan: ProcessingPlan): ProcessingPlanItem {
  const item = plan.items.find(
    (candidate) =>
      (candidate.status === "pending" || candidate.status === "running") &&
      candidate.target !== undefined,
  );

  if (item === undefined) {
    throw new Error("The processing plan has no pending valid CSV to demonstrate");
  }

  return item;
}

export function findBulkListingPage(pages: Page[]): Page | undefined {
  return [...pages]
    .reverse()
    .find((page) => BULK_LISTING_PATH.test(new URL(page.url()).pathname));
}

export interface AttachedDemoResult {
  item: ProcessingPlanItem;
  pageContext: CardmarketPageContext;
  preview: ImportPreviewDiagnostics;
}

export async function runAttachedDemo(input: {
  plan: ProcessingPlan;
  cdpEndpoint: string;
}): Promise<AttachedDemoResult> {
  const item = selectDemoItem(input.plan);
  const target = item.target!;
  const batch = await loadBatch(item.filePath);
  const setBatch = selectSetBatch(
    batch,
    target.setCode ?? target.setName ?? target.setTag,
  );

  let browser;
  try {
    browser = await chromium.connectOverCDP(input.cdpEndpoint);
  } catch (error) {
    throw new Error(
      `Could not attach to Chrome at ${input.cdpEndpoint}. Start Chrome with remote debugging, then try again.`,
      { cause: error },
    );
  }

  try {
    const page = findBulkListingPage(
      browser.contexts().flatMap((context) => context.pages()),
    );

    if (page === undefined) {
      throw new Error(
        "No open Cardmarket Bulk List Cards tab was found in the attached Chrome session",
      );
    }

    await page.bringToFront();
    const pageContext = await prepareCardmarketSetPage(
      page,
      setBatch,
      target.rarity,
    );
    const stagedCsvPath = await stageSetCsv(
      path.resolve("reports", "staged"),
      setBatch,
    );
    const bridge = new CardmarketCsvImportBridge();
    const outcome = await bridge.requestDryRun({
      page,
      fullBatch: batch,
      setBatch,
      stagedCsvPath,
      pageContext,
      // The public 1.4.1 build can reject otherwise valid rows when the current
      // Cardmarket URL does not expose idExpansion. The page was already
      // selected exactly above, so omit this redundant mapping for the demo.
      mapSetColumn: false,
    });

    return { item, pageContext, preview: outcome.preview };
  } finally {
    // For a connected browser this disconnects Playwright; it does not close
    // the user's Chrome process or its tabs.
    await browser.close();
  }
}
