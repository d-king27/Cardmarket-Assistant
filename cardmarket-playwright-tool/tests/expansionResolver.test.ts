import assert from "node:assert/strict";
import test from "node:test";

import { resolveExpansionOption } from "../src/expansionResolver.js";

const options = [
  { label: "Aaron Miller Tokens", value: "tokens" },
  { label: "Aetherdrift", value: "aetherdrift" },
  { label: "Ravnica Remastered", value: "rvr" },
];

test("prefers the exact Cardmarket expansion name", async () => {
  const result = await resolveExpansionOption(options, {
    setCode: "DFT",
    setName: "Aetherdrift",
    records: [],
  });

  assert.equal(result.value, "aetherdrift");
  assert.equal(result.method, "exact-name");
});

test("refuses to guess when no exact dropdown option exists", async () => {
  await assert.rejects(
    resolveExpansionOption(options, {
      setCode: "UNKNOWN",
      setName: "Aether Drift Special",
      records: [],
    }),
    /Refusing to guess/i,
  );
});

test("allows a constrained reasoner to choose only an existing option", async () => {
  const result = await resolveExpansionOption(
    options,
    {
      setCode: "DFT",
      setName: "Aether Drift",
      records: [],
    },
    {
      chooseOption: async () => "aetherdrift",
    },
  );

  assert.equal(result.value, "aetherdrift");
  assert.equal(result.method, "reasoner");
});
