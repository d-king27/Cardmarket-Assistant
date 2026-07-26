// @vitest-environment node

import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  QueuePublishRequest,
  QueueSourceCard,
} from "../src/cardmarket/queueModels";
import {
  getQueueJob,
  listQueueJobs,
  publishQueueJob,
  QueueJobError,
} from "./cardmarketJobStore";

const temporaryDirectories: string[] = [];

async function runtimeDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cardmarket-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

function card(overrides: Partial<QueueSourceCard> = {}): QueueSourceCard {
  return {
    id: "card-1",
    sourceRow: 2,
    name: "Zahur, Glory's Past",
    setCode: "DFT",
    setName: "Aetherdrift",
    collectorNumber: "1",
    finish: "normal",
    rarity: "rare",
    quantity: 2,
    manaBoxId: null,
    scryfallId: null,
    purchasePrice: null,
    purchasePriceCurrency: null,
    misprint: false,
    altered: false,
    condition: "near_mint",
    language: "en",
    addedAt: null,
    targetPrice: 2.5,
    notes: "",
    validationIssues: [],
    ...overrides,
  };
}

function request(cards: QueueSourceCard[], excludeBlockedRows = false): QueuePublishRequest {
  return {
    collectionId: "collection-1",
    collectionName: "Main collection",
    settings: {
      scope: "all",
      maximumRows: 75,
      priceSource: "targetPrice",
      excludeBlockedRows,
    },
    cards,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Cardmarket queue job store", () => {
  it("publishes CSVs and a validated manifest atomically", async () => {
    const runtime = await runtimeDirectory();
    const published = await publishQueueJob(request([card()]), {
      runtimeDirectory: runtime,
      jobId: "job-test-1",
      now: new Date("2026-07-26T12:00:00.000Z"),
    });

    expect(published.manifest.summary).toMatchObject({
      sourceRecordCount: 1,
      queuedRecordCount: 1,
      excludedRecordCount: 0,
      batchCount: 1,
    });
    const csv = await readFile(
      path.join(published.directory, "csv", "001__DFT__rare.csv"),
      "utf8",
    );
    expect(csv).toContain('"Price"');
    expect(csv).toContain('"2.50"');
    expect(await readdir(path.join(runtime, "jobs"))).toEqual(["job-test-1"]);
    expect(await listQueueJobs(runtime)).toHaveLength(1);
    expect((await getQueueJob("job-test-1", runtime))?.manifest.jobId).toBe("job-test-1");
  });

  it("requires explicit exclusion when blocked rows are present", async () => {
    const runtime = await runtimeDirectory();
    await expect(
      publishQueueJob(request([card({ targetPrice: null })]), {
        runtimeDirectory: runtime,
        jobId: "job-blocked",
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<QueueJobError>>({ status: 422 }));
  });

  it("records explicitly excluded rows while publishing ready rows", async () => {
    const runtime = await runtimeDirectory();
    const published = await publishQueueJob(
      request(
        [
          card({ id: "ready" }),
          card({ id: "blocked", targetPrice: null, collectorNumber: "2" }),
        ],
        true,
      ),
      {
        runtimeDirectory: runtime,
        jobId: "job-excluded",
      },
    );

    expect(published.manifest.summary.queuedRecordCount).toBe(1);
    expect(published.manifest.summary.excludedRecordCount).toBe(1);
    expect(published.manifest.excludedRows).toEqual([
      expect.objectContaining({ cardId: "blocked", code: "target_price_required" }),
    ]);
  });

  it("rejects path-like job identifiers", async () => {
    const runtime = await runtimeDirectory();
    await expect(getQueueJob("../outside", runtime)).rejects.toEqual(
      expect.objectContaining<Partial<QueueJobError>>({ status: 400 }),
    );
  });
});
