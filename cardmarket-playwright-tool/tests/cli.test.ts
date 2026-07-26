import assert from "node:assert/strict";
import test from "node:test";

import { getHelpText, parseCliArguments } from "../src/cli.js";

test("parses queue-runtime discovery options", () => {
  assert.deepEqual(
    parseCliArguments([
      "jobs",
      "--runtime-dir",
      "C:\\runtime",
      "--job",
      "job-test-1",
    ]),
    {
      command: "jobs",
      runtimeDir: "C:\\runtime",
      jobId: "job-test-1",
      retryFailed: false,
      help: false,
    },
  );
});

test("parses attached-stage selection options", () => {
  assert.deepEqual(
    parseCliArguments([
      "stage",
      "--job",
      "job-test-1",
      "--batch",
      "batch-002",
      "--cdp",
      "http://127.0.0.1:9333",
    ]),
    {
      command: "stage",
      jobId: "job-test-1",
      batchId: "batch-002",
      cdpEndpoint: "http://127.0.0.1:9333",
      retryFailed: false,
      help: false,
    },
  );
});

test("documents shared queue discovery as the default plan source", () => {
  const help = getHelpText();

  assert.match(help, /jobs.+--runtime-dir/);
  assert.match(help, /plan.+--runtime-dir/);
  assert.match(help, /legacy standalone CSV directory/);
  assert.match(help, /stage.+--batch/);
});
