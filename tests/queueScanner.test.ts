import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scanCsvDirectory } from "../src/queueScanner.js";

async function createDropDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "cardmarket-queue-"));
}

test("scans ready CSVs in filename order and reads set/rarity columns", async () => {
  const directory = await createDropDirectory();
  await writeFile(
    path.join(directory, "010__RVR__uncommon.csv"),
    "Name,Quantity,Set code,Set name,Rarity\nLightning Helix,1,RVR,Ravnica Remastered,uncommon\n",
  );
  await writeFile(
    path.join(directory, "002__DFT__rare.csv"),
    "Name,Quantity,Set code,Set name,Rarity\nZahur,1,DFT,Aetherdrift,rare\n",
  );

  const items = await scanCsvDirectory(directory);

  assert.deepEqual(
    items.map((item) => item.fileName),
    ["002__DFT__rare.csv", "010__RVR__uncommon.csv"],
  );
  assert.equal(items[0]?.status, "pending");
  assert.deepEqual(items[0]?.target, {
    setTag: "DFT",
    setCode: "DFT",
    setName: "Aetherdrift",
    rarity: "rare",
  });
  assert.equal(items[0]?.validation?.metadataSource, "columns");
});

test("uses SET__RARITY filename tags when metadata columns are absent", async () => {
  const directory = await createDropDirectory();
  await writeFile(
    path.join(directory, "001__DFT__rare.csv"),
    "Name,Quantity\nZahur,1\n",
  );

  const [item] = await scanCsvDirectory(directory);

  assert.equal(item?.status, "pending");
  assert.deepEqual(item?.target, {
    setTag: "DFT",
    rarity: "rare",
  });
  assert.equal(item?.validation?.metadataSource, "filename");
});

test("keeps multi-rarity files visible as invalid plan items", async () => {
  const directory = await createDropDirectory();
  await writeFile(
    path.join(directory, "bad.csv"),
    "Name,Quantity,Set code,Rarity\nOne,1,DFT,rare\nTwo,1,DFT,uncommon\n",
  );

  const [item] = await scanCsvDirectory(directory);

  assert.equal(item?.status, "invalid");
  assert.match(item?.validationError ?? "", /multiple rarity values/i);
});

test("rejects conflicting filename and CSV tags", async () => {
  const directory = await createDropDirectory();
  await writeFile(
    path.join(directory, "001__RVR__rare.csv"),
    "Name,Quantity,Set code,Rarity\nZahur,1,DFT,rare\n",
  );

  const [item] = await scanCsvDirectory(directory);

  assert.equal(item?.status, "invalid");
  assert.match(item?.validationError ?? "", /conflicts with CSV set code/i);
});

test("marks invalid quantities before they enter the queue", async () => {
  const directory = await createDropDirectory();
  await writeFile(
    path.join(directory, "001__DFT__rare.csv"),
    "Name,Quantity\nZahur,0\n",
  );

  const [item] = await scanCsvDirectory(directory);

  assert.equal(item?.status, "invalid");
  assert.match(item?.validationError ?? "", /invalid Quantity: 0/i);
});
