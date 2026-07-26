import path from "node:path";

import {
  chromium,
  type Browser,
  type Page,
} from "@playwright/test";

import { loadBatch } from "./batchLoader.js";
import { prepareCardmarketSetPage } from "./cardmarketNavigator.js";
import { stageSetCsv } from "./csvStager.js";
import { CardmarketCsvImportBridge } from "./extensionBridge.js";
import {
  revalidateQueueJobItem,
  type RevalidatedQueueItem,
} from "./queueJobScanner.js";
import { saveProcessingPlan } from "./processingPlan.js";
import { selectSetBatch } from "./setPlanner.js";
import { saveStageResult } from "./stageResultStore.js";
import type {
  ProcessingNote,
  ProcessingPlan,
  ProcessingPlanItem,
} from "./queueTypes.js";
import {
  ListingBatchMessageSchema,
  type CardmarketPageContext,
  type ImportPreviewDiagnostics,
} from "./types.js";

const BULK_LISTING_PATH = /\/Stock\/ListingMethods\/BulkListing/i;

export interface StageSelection {
  jobId?: string;
  batchId?: string;
  retryFailed?: boolean;
}

function isStageCandidate(
  item: ProcessingPlanItem,
  retryFailed: boolean,
): boolean {
  return (
    item.target !== undefined &&
    (item.status === "pending" ||
      item.status === "running" ||
      (retryFailed && item.status === "failed"))
  );
}

export function selectStageItem(
  plan: ProcessingPlan,
  selection: StageSelection = {},
): ProcessingPlanItem {
  const candidates = plan.items.filter((item) =>
    isStageCandidate(item, selection.retryFailed ?? false),
  );
  const selected = candidates.filter((item) => {
    const jobMatches =
      selection.jobId === undefined ||
      (item.source?.kind === "queue-job" &&
        item.source.jobId === selection.jobId);
    const batchMatches =
      selection.batchId === undefined ||
      (item.source?.kind === "queue-job"
        ? item.source.batchId === selection.batchId
        : item.id === selection.batchId);
    return jobMatches && batchMatches;
  });

  if (selection.jobId === undefined && selection.batchId === undefined) {
    const nextUnstaged = selected.find((item) => item.staging === undefined);
    if (nextUnstaged !== undefined) {
      return nextUnstaged;
    }
    throw new Error(
      "The processing plan has no unstaged pending CSV. Select a batch explicitly to restage it.",
    );
  }

  if (selected.length === 0) {
    throw new Error("No pending processing-plan item matched the requested job and batch");
  }
  if (selected.length > 1 && selection.batchId !== undefined) {
    throw new Error(
      `Batch ${selection.batchId} exists in more than one job. Add --job to select it unambiguously.`,
    );
  }

  return selected.find((item) => item.staging === undefined) ?? selected[0]!;
}

export const selectDemoItem = (plan: ProcessingPlan): ProcessingPlanItem =>
  selectStageItem(plan);

export function findBulkListingPage(pages: Page[]): Page | undefined {
  return [...pages]
    .reverse()
    .find((page) => BULK_LISTING_PATH.test(new URL(page.url()).pathname));
}

export interface AttachedStageResult {
  item: ProcessingPlanItem;
  pageContext: CardmarketPageContext;
  preview: ImportPreviewDiagnostics;
  resultPath: string;
}

export type AttachedDemoResult = AttachedStageResult;

function addNote(
  item: ProcessingPlanItem,
  kind: ProcessingNote["kind"],
  message: string,
): void {
  item.notes.push({
    at: new Date().toISOString(),
    kind,
    message,
  });
}

function safeDirectoryPart(value: string): string {
  return (
    value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "batch"
  );
}

async function revalidateItem(
  item: ProcessingPlanItem,
): Promise<RevalidatedQueueItem | undefined> {
  if (item.source?.kind !== "queue-job") {
    return undefined;
  }
  return revalidateQueueJobItem(item);
}

export async function runAttachedStage(input: {
  plan: ProcessingPlan;
  planPath: string;
  cdpEndpoint: string;
  selection?: StageSelection;
  stagedDirectory?: string;
  fallbackResultsDirectory?: string;
}): Promise<AttachedStageResult> {
  const item = selectStageItem(input.plan, input.selection);
  const revalidated = await revalidateItem(item);
  const currentItem = revalidated?.item ?? item;
  const target = currentItem.target;
  if (target === undefined) {
    throw new Error("The selected processing-plan item has no Cardmarket target");
  }

  const loadedBatch = await loadBatch(currentItem.filePath);
  const batch =
    item.source?.kind === "queue-job" && revalidated !== undefined
      ? ListingBatchMessageSchema.parse({
          ...loadedBatch,
          batchId: item.source.batchId,
          createdAt: revalidated.manifest.createdAt,
        })
      : loadedBatch;
  const setBatch = selectSetBatch(
    batch,
    target.setCode ?? target.setName ?? target.setTag,
  );
  const previousStatus = item.status;
  item.status = "running";
  item.attempts += 1;
  addNote(item, "info", `Started attached-browser staging attempt ${item.attempts}.`);
  await saveProcessingPlan(input.planPath, input.plan);

  let browser: Browser | undefined;
  try {
    try {
      browser = await chromium.connectOverCDP(input.cdpEndpoint);
    } catch (error) {
      throw new Error(
        `Could not attach to Chrome at ${input.cdpEndpoint}. Start Chrome with remote debugging, then try again.`,
        { cause: error },
      );
    }

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
      path.join(
        path.resolve(input.stagedDirectory ?? path.join("reports", "staged")),
        safeDirectoryPart(item.id),
      ),
      setBatch,
    );
    const bridge = new CardmarketCsvImportBridge();
    const outcome = await bridge.requestDryRun({
      page,
      fullBatch: batch,
      setBatch,
      stagedCsvPath,
      pageContext,
      // Cardmarket's page was selected exactly above. Omitting the redundant
      // set mapping also avoids the public extension's idExpansion mismatch.
      mapSetColumn: false,
    });
    const resultPath = await saveStageResult({
      item,
      result: outcome.result,
      fallbackResultsDirectory:
        input.fallbackResultsDirectory ?? path.join("reports", "results"),
    });

    item.status = "pending";
    item.staging = {
      stagedAt: outcome.result.generatedAt,
      state: outcome.preview.state,
      selectedCount: outcome.preview.selectedCount,
      eligibleCount: outcome.preview.eligibleCount,
      parsedCount: outcome.preview.parsedCount,
      resultPath,
    };
    addNote(
      item,
      "success",
      `Extension preview staged without Fill Page: ${outcome.preview.selectedCount} selected of ${outcome.preview.eligibleCount} (${outcome.preview.parsedCount} total).`,
    );
    await saveProcessingPlan(input.planPath, input.plan);

    return { item, pageContext, preview: outcome.preview, resultPath };
  } catch (error) {
    item.status = previousStatus === "running" ? "pending" : previousStatus;
    addNote(
      item,
      "failure",
      `Attached-browser staging failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await saveProcessingPlan(input.planPath, input.plan);
    throw error;
  } finally {
    // For a connected browser this disconnects Playwright; it does not close
    // the user's Chrome process or its tabs.
    await browser?.close().catch(() => undefined);
  }
}

export const runAttachedDemo = runAttachedStage;
