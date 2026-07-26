import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CARDMARKET_QUEUE_VERSION,
  ListingBatchSchema,
  ListingBatchMessageSchema,
  PROTOCOL_VERSION,
  queueJobManifestSchema,
} from "../src/index.js";

describe("shared Cardmarket contracts", () => {
  it("accepts a versioned listing batch", () => {
    const batch = ListingBatchMessageSchema.parse({
      protocolVersion: PROTOCOL_VERSION,
      type: "listing-batch",
      batchId: "batch-1",
      createdAt: "2026-07-26T12:00:00.000Z",
      records: [{ id: "card-1", name: "Lightning Bolt", quantity: 1 }],
    });

    assert.equal(batch.records[0]?.name, "Lightning Bolt");
    assert.equal(ListingBatchSchema.parse(batch).batchId, "batch-1");
  });

  it("accepts future queue processing states without changing version 1", () => {
    const job = queueJobManifestSchema.parse({
      jobVersion: CARDMARKET_QUEUE_VERSION,
      jobId: "job-test-1",
      status: "processing",
      createdAt: "2026-07-26T12:00:00.000Z",
      collection: { id: "collection-1", name: "Main" },
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
          batchId: "batch-1",
          sequence: 1,
          filename: "001.csv",
          setCode: "DFT",
          setName: "Aetherdrift",
          rarity: "rare",
          rowCount: 1,
          totalQuantity: 1,
          sha256: "a".repeat(64),
          status: "processing",
        },
      ],
      excludedRows: [],
      warnings: [],
    });

    assert.equal(job.batches[0]?.status, "processing");
  });

  it("rejects unsupported protocol versions", () => {
    const result = ListingBatchMessageSchema.safeParse({
      protocolVersion: 2,
      type: "listing-batch",
      batchId: "batch-1",
      createdAt: "2026-07-26T12:00:00.000Z",
      records: [{ id: "card-1", name: "Lightning Bolt", quantity: 1 }],
    });

    assert.equal(result.success, false);
  });
});
