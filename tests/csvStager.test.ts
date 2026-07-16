import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "csv-parse/sync";

import { buildSafeImportCsv } from "../src/csvStager.js";

test("stages only safe extension import columns", () => {
  const csv = buildSafeImportCsv({
    setCode: "DFT",
    setName: "Aetherdrift",
    records: [
      {
        id: "one",
        name: "Embalmed Ascendant",
        quantity: 1,
        setCode: "DFT",
        setName: "Aetherdrift",
        collectorNumber: "201",
        language: "en",
        condition: "near_mint",
        finish: "normal",
        purchasePrice: "0.14",
      },
    ],
  });
  const rows = parse(csv, { columns: true }) as Record<string, string>[];

  assert.deepEqual(Object.keys(rows[0]!), [
    "Name",
    "Language",
    "Condition",
    "Set code",
    "Foil",
    "Quantity",
  ]);
  assert.equal(rows[0]?.Name, "Embalmed Ascendant");
  assert.equal("Purchase price" in rows[0]!, false);
  assert.equal("Collector number" in rows[0]!, false);
  assert.equal("Price" in rows[0]!, false);
  assert.equal("Comment" in rows[0]!, false);
});
