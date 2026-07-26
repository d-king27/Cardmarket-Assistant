import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import type { QueueJobManifest } from "@cardmarket-assistant/contracts";

import {
  formatQueueRuntimeScan,
  revalidateQueueJobItem,
  scanQueueRuntime,
} from "../src/queueJobScanner.js";

const CSV =
  "Name,Quantity,Set code,Set name,Rarity\nZahur,2,DFT,Aetherdrift,rare\n";

async function createRuntime(t: TestContext): Promise<string> {
  const runtime = await mkdtemp(path.join(os.tmpdir(), "cardmarket-runtime-"));
  t.after(() => rm(runtime, { recursive: true, force: true }));
  return runtime;
}

function manifest(
  jobId: string,
  overrides: Partial<QueueJobManifest> = {},
): QueueJobManifest {
  return {
    jobVersion: 1,
    jobId,
    status: "ready",
    createdAt: "2026-07-26T12:00:00.000Z",
    collection: { id: "collection-1", name: "Main collection" },
    settings: {
      scope: "all",
      maximumRows: 75,
      priceSource: "targetPrice",
      excludeBlockedRows: false,
    },
    summary: {
      sourceRecordCount: 1,
      queuedRecordCount: 1,
      excludedRecordCount: 0,
      warningCount: 0,
      batchCount: 1,
    },
    batches: [
      {
        batchId: "batch-001",
        sequence: 1,
        filename: "001__DFT__rare.csv",
        setCode: "DFT",
        setName: "Aetherdrift",
        rarity: "rare",
        rowCount: 1,
        totalQuantity: 2,
        sha256: createHash("sha256").update(CSV).digest("hex"),
        status: "pending",
      },
    ],
    excludedRows: [],
    warnings: [],
    ...overrides,
  };
}

async function writeJob(
  runtime: string,
  candidate: QueueJobManifest,
  csv = CSV,
): Promise<void> {
  const directory = path.join(runtime, "jobs", candidate.jobId);
  await mkdir(path.join(directory, "csv"), { recursive: true });
  await mkdir(path.join(directory, "results"), { recursive: true });
  await writeFile(
    path.join(directory, "manifest.json"),
    `${JSON.stringify(candidate, null, 2)}\n`,
  );
  await writeFile(
    path.join(directory, "csv", "001__DFT__rare.csv"),
    csv,
  );
}

test("discovers and validates a data-tool queue job", async (t) => {
  const runtime = await createRuntime(t);
  const jobId = "job-2026-07-26-001";
  await writeJob(runtime, manifest(jobId));

  const scan = await scanQueueRuntime(runtime);

  assert.equal(scan.jobs.length, 1);
  assert.equal(scan.jobs[0]?.state, "ready");
  assert.equal(scan.actionableItems.length, 1);
  assert.equal(scan.actionableItems[0]?.fileName, "001__DFT__rare.csv");
  assert.deepEqual(scan.actionableItems[0]?.source, {
    kind: "queue-job",
    jobId,
    batchId: "batch-001",
    manifestPath: path.join(runtime, "jobs", jobId, "manifest.json"),
  });
  assert.equal(scan.actionableItems[0]?.validation?.totalQuantity, 2);
  const revalidated = await revalidateQueueJobItem(
    scan.actionableItems[0]!,
  );
  assert.equal(revalidated.manifest.jobId, jobId);
  assert.match(formatQueueRuntimeScan(scan), /Actionable batches 1/);
});

test("revalidates the planned fingerprint immediately before browser handoff", async (t) => {
  const runtime = await createRuntime(t);
  const jobId = "job-browser-handoff";
  await writeJob(runtime, manifest(jobId));
  const initial = await scanQueueRuntime(runtime);
  const plannedItem = initial.actionableItems[0]!;
  await writeFile(plannedItem.filePath, CSV.replace("Zahur", "Changed card"));

  await assert.rejects(
    () => revalidateQueueJobItem(plannedItem),
    /no longer ready|no longer actionable/i,
  );
});

test("rejects a CSV changed after publication", async (t) => {
  const runtime = await createRuntime(t);
  const jobId = "job-2026-07-26-stale";
  await writeJob(
    runtime,
    manifest(jobId),
    CSV.replace("Zahur", "Changed card"),
  );

  const scan = await scanQueueRuntime(runtime);

  assert.equal(scan.jobs[0]?.state, "invalid");
  assert.equal(scan.actionableItems.length, 0);
  assert.match(scan.jobs[0]?.error ?? "", /fingerprint does not match/i);
});

test("accepts producer fallback set codes when the source row has only a set name", async (t) => {
  const runtime = await createRuntime(t);
  const jobId = "job-set-name-only";
  const csv =
    "Name,Quantity,Set code,Set name,Rarity\nZahur,2,,Aetherdrift,rare\n";
  const candidate = manifest(jobId);
  candidate.batches[0]!.setCode = "AETHERDRIFT";
  candidate.batches[0]!.sha256 = createHash("sha256")
    .update(csv)
    .digest("hex");
  await writeJob(runtime, candidate, csv);

  const scan = await scanQueueRuntime(runtime);

  assert.equal(scan.jobs[0]?.state, "ready");
  assert.equal(scan.actionableItems.length, 1);
});

test("lists malformed jobs but ignores atomic staging directories", async (t) => {
  const runtime = await createRuntime(t);
  const invalidDirectory = path.join(runtime, "jobs", "job-invalid-json");
  await mkdir(invalidDirectory, { recursive: true });
  await writeFile(path.join(invalidDirectory, "manifest.json"), "{not-json");
  await mkdir(
    path.join(runtime, "jobs", ".staging-job-in-progress"),
    { recursive: true },
  );

  const scan = await scanQueueRuntime(runtime);

  assert.equal(scan.jobs.length, 1);
  assert.equal(scan.jobs[0]?.state, "invalid");
  assert.match(scan.jobs[0]?.error ?? "", /JSON/i);
});

test("rejects undeclared CSV files in an otherwise valid job", async (t) => {
  const runtime = await createRuntime(t);
  const jobId = "job-extra-file";
  await writeJob(runtime, manifest(jobId));
  await writeFile(
    path.join(runtime, "jobs", jobId, "csv", "unexpected.csv"),
    CSV,
  );

  const scan = await scanQueueRuntime(runtime);

  assert.equal(scan.jobs[0]?.state, "invalid");
  assert.match(scan.jobs[0]?.error ?? "", /not declared by the manifest/i);
});

test("rejects manifest filenames that escape the job CSV directory", async (t) => {
  const runtime = await createRuntime(t);
  const jobId = "job-unsafe-path";
  const unsafe = manifest(jobId);
  unsafe.batches[0]!.filename = "../outside.csv";
  await writeJob(runtime, unsafe);

  const scan = await scanQueueRuntime(runtime);

  assert.equal(scan.jobs[0]?.state, "invalid");
  assert.equal(scan.actionableItems.length, 0);
  assert.match(scan.jobs[0]?.error ?? "", /unsafe CSV filename/i);
});

test("can select one job explicitly", async (t) => {
  const runtime = await createRuntime(t);
  await writeJob(runtime, manifest("job-first"));
  await writeJob(
    runtime,
    manifest("job-second", { createdAt: "2026-07-27T12:00:00.000Z" }),
  );

  const scan = await scanQueueRuntime(runtime, { jobId: "job-second" });

  assert.deepEqual(scan.jobs.map((job) => job.directoryName), ["job-second"]);
});
