import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";

import { chromium } from "@playwright/test";

import { openCardmarketSetPage } from "../src/cardmarketNavigator.js";
import { stageSetCsv } from "../src/csvStager.js";
import { CardmarketCsvImportBridge } from "../src/extensionBridge.js";
import type {
  ListingBatchMessage,
  SetBatch,
} from "../src/types.js";

const setBatch: SetBatch = {
  setCode: "DFT",
  setName: "Aetherdrift",
  records: [
    {
      id: "one",
      name: "Embalmed Ascendant",
      quantity: 1,
      setCode: "DFT",
      setName: "Aetherdrift",
      language: "en",
      condition: "near_mint",
      finish: "normal",
    },
    {
      id: "two",
      name: "Zahur, Glory's Past",
      quantity: 1,
      setCode: "DFT",
      setName: "Aetherdrift",
      language: "en",
      condition: "near_mint",
      finish: "normal",
    },
  ],
};

const batch: ListingBatchMessage = {
  protocolVersion: 1,
  type: "listing-batch",
  batchId: "integration",
  createdAt: "2026-07-16T00:00:00.000Z",
  records: setBatch.records,
};

function renderPage(selectedExpansion: string): string {
  const selected = (value: string): string =>
    selectedExpansion === value ? " selected" : "";

  return `<!doctype html>
<html>
  <body>
    <h1>Bulk List Cards</h1>
    <label for="expansion">Expansion</label>
    <select id="expansion">
      <option value="tokens"${selected("tokens")}>Aaron Miller Tokens</option>
      <option value="aetherdrift"${selected("aetherdrift")}>Aetherdrift</option>
    </select>
    <label for="sort">Sort by</label>
    <select id="sort">
      <option value="name">Name</option>
      <option value="collector">Collectors Number</option>
    </select>
    <button id="filter">FILTER</button>
    <div id="BulkAccordion">Bulk modification</div>
    <button id="import">IMPORT CSV...</button>
    <div>291 Hits</div>
    <table><thead><tr><th scope="col">Name</th></tr></thead></table>
    <div id="modal-host"></div>
    <script>
      window.__mappings = {};
      window.__fillClicks = 0;
      document.querySelector("#filter").addEventListener("click", () => {
        const expansion = document.querySelector("#expansion").value;
        window.location.href = "/?expansion=" + encodeURIComponent(expansion);
      });
      document.querySelector("#import").addEventListener("click", () => {
        document.querySelector("#modal-host").innerHTML = \`
          <div role="dialog">
            <h2>Import listings from CSV</h2>
            <label for="csv">CSV File</label><input id="csv" type="file">
            <label for="name">Name Column</label><input id="name">
            <label for="language">Language Column</label><input id="language">
            <label for="condition">Condition Column</label><input id="condition">
            <label for="signed">Signed Column</label><input id="signed">
            <label for="comment">Comment Column</label><input id="comment">
            <label for="set">Set Column</label><input id="set">
            <label for="foil">Foil Column</label><input id="foil">
            <label for="quantity">Quantity Column</label><input id="quantity">
            <label for="price">Price Column</label><input id="price">
            <button id="select-rows">Select Rows</button>
          </div>
        \`;
        document.querySelector("#select-rows").addEventListener("click", () => {
          for (const id of ["name", "language", "condition", "signed", "comment", "set", "foil", "quantity", "price"]) {
            window.__mappings[id] = document.querySelector("#" + id).value;
          }
          document.querySelector("[role=dialog]").innerHTML = \`
            <h2>Import listings from CSV</h2>
            <div>0 selected of 0 (2 total)</div>
            <button id="fill-page">FILL PAGE!</button>
          \`;
          document.querySelector("#fill-page").addEventListener("click", () => {
            window.__fillClicks += 1;
          });
        });
      });
    </script>
  </body>
</html>`;
}

test("navigates to the exact set and stages the extension preview without filling", async () => {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderPage(requestUrl.searchParams.get("expansion") ?? ""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Mock server did not expose a TCP port");
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const url = `http://127.0.0.1:${address.port}/`;
    const pageContext = await openCardmarketSetPage(page, url, setBatch);

    assert.equal(pageContext.expansionLabel, "Aetherdrift");
    assert.equal(pageContext.hitCount, 291);
    assert.equal(pageContext.resultsTablePresent, true);
    assert.equal(pageContext.extensionUiPresent, true);

    const stagedCsvPath = await stageSetCsv(
      path.resolve("test-results", "staged"),
      setBatch,
    );
    const bridge = new CardmarketCsvImportBridge();
    const outcome = await bridge.requestDryRun({
      page,
      fullBatch: batch,
      setBatch,
      stagedCsvPath,
      pageContext,
    });

    assert.equal(outcome.preview.state, "no-current-page-matches");
    assert.equal(outcome.preview.parsedCount, 2);
    const browserState = await page.evaluate(() => ({
      mappings: (
        window as unknown as { __mappings: Record<string, string> }
      ).__mappings,
      fillClicks: (window as unknown as { __fillClicks: number }).__fillClicks,
    }));

    assert.deepEqual(browserState.mappings, {
      name: "Name",
      language: "Language",
      condition: "Condition",
      signed: "",
      comment: "",
      set: "Set code",
      foil: "Foil",
      quantity: "Quantity",
      price: "",
    });
    assert.equal(browserState.fillClicks, 0);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
  }
});
