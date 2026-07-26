import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { saveStageResult } from "../src/stageResultStore.js";
import type { ProcessingPlanItem } from "../src/queueTypes.js";
import type { ListingBatchResultMessage } from "../src/types.js";

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stage-results-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function result(batchId: string): ListingBatchResultMessage {
  return {
    protocolVersion: 1,
    type: "listing-batch-result",
    batchId,
    mode: "dry-run",
    status: "not-run",
    pageContext: {
      url: "https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing",
      title: "Bulk List Cards",
      bulkListingPresent: true,
      extensionUiPresent: true,
      resultsTablePresent: true,
      capturedAt: "2026-07-26T12:00:00.000Z",
    },
    results: [
      {
        recordId: "card-1",
        status: "not-run",
        message: "Staged only.",
      },
    ],
    errors: [],
    generatedAt: "2026-07-26T12:00:00.000Z",
  };
}

test("writes a queue-correlated dry-run result under the job results directory", async (t) => {
  const runtime = await temporaryDirectory(t);
  const jobId = "job-test-1";
  const jobDirectory = path.join(runtime, "jobs", jobId);
  await mkdir(path.join(jobDirectory, "results"), { recursive: true });
  await writeFile(path.join(jobDirectory, "manifest.json"), "{}");
  const item: ProcessingPlanItem = {
    id: `${jobId}--batch-001`,
    fileName: "001__DFT__rare.csv",
    filePath: path.join(jobDirectory, "csv", "001__DFT__rare.csv"),
    fingerprint: "fingerprint",
    status: "pending",
    attempts: 0,
    source: {
      kind: "queue-job",
      jobId,
      batchId: "batch-001",
      manifestPath: path.join(jobDirectory, "manifest.json"),
    },
    notes: [],
  };

  const savedPath = await saveStageResult({
    item,
    result: result("batch-001"),
    fallbackResultsDirectory: path.join(runtime, "fallback"),
    now: new Date("2026-07-26T12:00:00.000Z"),
  });

  assert.equal(path.dirname(savedPath), path.join(jobDirectory, "results"));
  assert.match(path.basename(savedPath), /^batch-001__.+__[a-f0-9]{8}__dry-run\.json$/);
  const saved = JSON.parse(await readFile(savedPath, "utf8")) as {
    batchId: string;
  };
  assert.equal(saved.batchId, "batch-001");
});
