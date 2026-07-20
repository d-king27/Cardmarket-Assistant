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
