import assert from "node:assert/strict";
import test from "node:test";

import { selectStageItem } from "../src/attachedDemo.js";
import {
  createOrRefreshProcessingPlan,
} from "../src/processingPlan.js";
import type { ProcessingPlanItem } from "../src/queueTypes.js";

function item(jobId: string, batchId: string): ProcessingPlanItem {
  return {
    id: `${jobId}--${batchId}`,
    fileName: "001__DFT__rare.csv",
    filePath: `C:\\runtime\\jobs\\${jobId}\\csv\\001__DFT__rare.csv`,
    fingerprint: `${jobId}-${batchId}`,
    status: "pending",
    attempts: 0,
    target: {
      setTag: "DFT",
      setCode: "DFT",
      setName: "Aetherdrift",
      rarity: "rare",
    },
    validation: {
      rowCount: 1,
      totalQuantity: 1,
      headers: ["Name", "Quantity"],
      metadataSource: "columns",
    },
    source: {
      kind: "queue-job",
      jobId,
      batchId,
      manifestPath: `C:\\runtime\\jobs\\${jobId}\\manifest.json`,
    },
    notes: [],
  };
}

test("selects the next batch that has not already been staged", () => {
  const first = item("job-one", "batch-001");
  first.staging = {
    stagedAt: "2026-07-26T12:00:00.000Z",
    state: "preview-ready",
    selectedCount: 1,
    eligibleCount: 1,
    parsedCount: 1,
    resultPath: "C:\\results\\first.json",
  };
  const second = item("job-one", "batch-002");
  const plan = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [first, second],
  });

  const selected = selectStageItem(plan);
  assert.equal(selected.source?.kind, "queue-job");
  assert.equal(
    selected.source?.kind === "queue-job"
      ? selected.source.batchId
      : undefined,
    "batch-002",
  );
});

test("requires a job ID when a batch ID is ambiguous", () => {
  const plan = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [
      item("job-one", "batch-001"),
      item("job-two", "batch-001"),
    ],
  });

  assert.throws(
    () => selectStageItem(plan, { batchId: "batch-001" }),
    /more than one job/i,
  );
  const selected = selectStageItem(plan, {
    jobId: "job-two",
    batchId: "batch-001",
  });
  assert.equal(
    selected.source?.kind === "queue-job"
      ? selected.source.jobId
      : undefined,
    "job-two",
  );
});

test("does not stage failed items unless retry is explicit", () => {
  const failed = item("job-one", "batch-001");
  failed.status = "failed";
  const plan = createOrRefreshProcessingPlan({
    inputDirectory: "C:\\runtime",
    scannedItems: [failed],
  });

  assert.throws(() => selectStageItem(plan), /no unstaged pending CSV/i);
  assert.equal(
    selectStageItem(plan, { retryFailed: true }).status,
    "failed",
  );
});
