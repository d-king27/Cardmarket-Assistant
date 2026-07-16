import assert from "node:assert/strict";
import test from "node:test";

import { selectSetBatch } from "../src/setPlanner.js";
import type { ListingBatchMessage } from "../src/types.js";

const batch: ListingBatchMessage = {
  protocolVersion: 1,
  type: "listing-batch",
  batchId: "test",
  createdAt: "2026-07-16T00:00:00.000Z",
  records: [
    {
      id: "a",
      name: "Embalmed Ascendant",
      quantity: 1,
      setCode: "DFT",
      setName: "Aetherdrift",
    },
    {
      id: "b",
      name: "Zahur, Glory's Past",
      quantity: 1,
      setCode: "DFT",
      setName: "Aetherdrift",
    },
    {
      id: "c",
      name: "Lightning Helix",
      quantity: 1,
      setCode: "RVR",
      setName: "Ravnica Remastered",
    },
  ],
};

test("selects a set group by code", () => {
  const selected = selectSetBatch(batch, "DFT");
  assert.equal(selected.setName, "Aetherdrift");
  assert.deepEqual(
    selected.records.map((record) => record.id),
    ["a", "b"],
  );
});

test("requires --set when a batch contains multiple expansions", () => {
  assert.throws(
    () => selectSetBatch(batch),
    /batch contains 2 sets.*--set/i,
  );
});
