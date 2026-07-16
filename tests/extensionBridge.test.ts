import assert from "node:assert/strict";
import test from "node:test";

import { parsePreviewSummary } from "../src/extensionBridge.js";

test("treats an empty current-page preview as a valid no-match state", () => {
  assert.deepEqual(parsePreviewSummary("0 selected of 0 (14 total)"), {
    state: "no-current-page-matches",
    selectedCount: 0,
    eligibleCount: 0,
    parsedCount: 14,
    fillPageAvailable: false,
  });
});

test("parses a populated extension preview", () => {
  assert.deepEqual(parsePreviewSummary("2 selected of 3 (4 total)"), {
    state: "preview-ready",
    selectedCount: 2,
    eligibleCount: 3,
    parsedCount: 4,
    fillPageAvailable: false,
  });
});
