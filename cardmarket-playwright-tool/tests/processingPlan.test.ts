import assert from "node:assert/strict";
import test from "node:test";

import {
  createOrRefreshProcessingPlan,
  formatPlan,
} from "../src/processingPlan.js";
import type { ProcessingPlanItem } from "../src/queueTypes.js";

function pendingItem(fingerprint = "fingerprint-one"): ProcessingPlanItem {
  return {
    id: `DFT-${fingerprint}`,
    fileName: "001__DFT__rare.csv",
    filePath: "C:\\drop\\001__DFT__rare.csv",
    fingerprint,
    status: "pending",
    attempts: 0,
    target: { setTag: "DFT", setCode: "DFT", rarity: "rare" },
    validation: {
      rowCount: 2,
      headers: ["Name", "Quantity"],
      metadataSource: "filename",
    },
    notes: [],
  };
}

test("preserves successful history for an unchanged CSV", () => {
  const original = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\drop",
    scannedItems: [pendingItem()],
  });
  original.items[0]!.status = "succeeded";
  original.items[0]!.attempts = 1;
  original.items[0]!.notes.push({
    at: "2026-07-17T10:00:00.000Z",
    kind: "success",
    message: "Imported successfully.",
  });

  const refreshed = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\drop",
    scannedItems: [pendingItem()],
    previousPlan: original,
  });

  assert.equal(refreshed.items[0]?.status, "succeeded");
  assert.equal(refreshed.items[0]?.attempts, 1);
  assert.equal(refreshed.items[0]?.notes.at(-1)?.message, "Imported successfully.");
});

test("treats changed CSV content as a new pending item", () => {
  const original = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\drop",
    scannedItems: [pendingItem()],
  });
  original.items[0]!.status = "succeeded";

  const refreshed = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\drop",
    scannedItems: [pendingItem("fingerprint-two")],
    previousPlan: original,
  });

  assert.equal(refreshed.items[0]?.status, "pending");
  assert.equal(refreshed.items[0]?.attempts, 0);
});

test("formats plan items like a compact automated-test report", () => {
  const plan = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\drop",
    scannedItems: [pendingItem()],
  });
  const output = formatPlan(plan);

  assert.match(output, /PENDING\s+001__DFT__rare\.csv/);
  assert.match(output, /DFT \| rare \| 2 rows/);
  assert.match(output, /Total 1 \| Pending 1/);
});

test("does not carry history across different input directories", () => {
  const original = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\drop-one",
    scannedItems: [pendingItem()],
  });

  assert.throws(
    () =>
      createOrRefreshProcessingPlan({
        inputDirectory: "C:\\drop-two",
        scannedItems: [pendingItem()],
        previousPlan: original,
      }),
    /belongs to .*drop-one.*not .*drop-two/i,
  );
});

test("keeps identical batches from different queue jobs independent", () => {
  const first = pendingItem();
  first.source = {
    kind: "queue-job",
    jobId: "job-first",
    batchId: "batch-001",
    manifestPath: "C:\\runtime\\jobs\\job-first\\manifest.json",
  };
  const original = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [first],
  });
  original.items[0]!.status = "succeeded";

  const second = pendingItem();
  second.source = {
    kind: "queue-job",
    jobId: "job-second",
    batchId: "batch-001",
    manifestPath: "C:\\runtime\\jobs\\job-second\\manifest.json",
  };
  const refreshed = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [second],
    previousPlan: original,
  });

  assert.equal(refreshed.items[0]?.status, "pending");
});

test("preserves staging metadata when a queue batch is unchanged", () => {
  const scanned = pendingItem();
  const original = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [scanned],
  });
  original.items[0]!.staging = {
    stagedAt: "2026-07-26T12:00:00.000Z",
    state: "preview-ready",
    selectedCount: 1,
    eligibleCount: 1,
    parsedCount: 1,
    resultPath: "C:\\runtime\\results\\batch.json",
  };

  const refreshed = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [pendingItem()],
    previousPlan: original,
  });

  assert.equal(refreshed.items[0]?.staging?.state, "preview-ready");
});
