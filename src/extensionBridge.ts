import type { Locator, Page } from "@playwright/test";

import { importCsvButton } from "./cardmarketNavigator.js";
import { SAFE_IMPORT_COLUMNS } from "./csvStager.js";
import { PROTOCOL_VERSION } from "./types.js";
import type {
  CardmarketPageContext,
  ImportPreviewDiagnostics,
  ListingBatchMessage,
  ListingBatchResultMessage,
  SetBatch,
} from "./types.js";

export interface ExtensionDryRunOutcome {
  preview: ImportPreviewDiagnostics;
  result: ListingBatchResultMessage;
}

export interface ExtensionBridge {
  readonly adapterName: string;
  readonly mocked: boolean;

  requestDryRun(input: {
    page: Page;
    fullBatch: ListingBatchMessage;
    setBatch: SetBatch;
    stagedCsvPath: string;
    pageContext: CardmarketPageContext;
    mapSetColumn?: boolean;
  }): Promise<ExtensionDryRunOutcome>;
}

function labelledInput(dialog: Locator, label: string): Locator {
  return dialog
    .getByLabel(label, { exact: true })
    .or(
      dialog
        .getByText(label, { exact: true })
        .locator("xpath=following::input[1]"),
    )
    .first();
}

async function setColumnMapping(
  dialog: Locator,
  label: string,
  value: string,
): Promise<void> {
  const input = labelledInput(dialog, label);
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(value);
}

export function parsePreviewSummary(
  text: string,
): ImportPreviewDiagnostics {
  const match = text.match(
    /(\d+)\s+selected\s+of\s+(\d+)\s+\((\d+)\s+total\)/i,
  );

  if (match === null) {
    throw new Error(`Unable to parse extension preview summary: ${text}`);
  }

  const selectedCount = Number(match[1]);
  const eligibleCount = Number(match[2]);
  const parsedCount = Number(match[3]);

  return {
    state:
      eligibleCount === 0 ? "no-current-page-matches" : "preview-ready",
    selectedCount,
    eligibleCount,
    parsedCount,
    fillPageAvailable: false,
  };
}

export class CardmarketCsvImportBridge implements ExtensionBridge {
  readonly adapterName = "cardmarket-csv-import-ui";
  readonly mocked = false;

  async requestDryRun(input: {
    page: Page;
    fullBatch: ListingBatchMessage;
    setBatch: SetBatch;
    stagedCsvPath: string;
    pageContext: CardmarketPageContext;
    mapSetColumn?: boolean;
  }): Promise<ExtensionDryRunOutcome> {
    if (!input.pageContext.extensionUiPresent) {
      throw new Error("The extension Import CSV control is not visible");
    }

    await importCsvButton(input.page).click();
    const mappingDialog = input.page
      .getByRole("dialog")
      .filter({ hasText: /Import listings from CSV/i })
      .or(
        input.page
          .locator(".modal:visible")
          .filter({ hasText: /Import listings from CSV/i }),
      )
      .first();
    await mappingDialog.waitFor({ state: "visible", timeout: 10_000 });
    await mappingDialog.locator('input[type="file"]').setInputFiles(
      input.stagedCsvPath,
    );

    await setColumnMapping(mappingDialog, "Name Column", SAFE_IMPORT_COLUMNS.name);
    await setColumnMapping(
      mappingDialog,
      "Language Column",
      SAFE_IMPORT_COLUMNS.language,
    );
    await setColumnMapping(
      mappingDialog,
      "Condition Column",
      SAFE_IMPORT_COLUMNS.condition,
    );
    await setColumnMapping(mappingDialog, "Signed Column", "");
    await setColumnMapping(mappingDialog, "Comment Column", "");
    await setColumnMapping(
      mappingDialog,
      "Set Column",
      input.mapSetColumn === false ? "" : SAFE_IMPORT_COLUMNS.set,
    );
    await setColumnMapping(mappingDialog, "Foil Column", SAFE_IMPORT_COLUMNS.foil);
    await setColumnMapping(
      mappingDialog,
      "Quantity Column",
      SAFE_IMPORT_COLUMNS.quantity,
    );
    await setColumnMapping(mappingDialog, "Price Column", "");

    await mappingDialog
      .getByRole("button", { name: "Select Rows", exact: true })
      .click();

    const previewDialog = input.page
      .getByRole("dialog")
      .filter({ hasText: /Import listings from CSV/i })
      .or(
        input.page
          .locator(".modal:visible")
          .filter({ hasText: /Import listings from CSV/i }),
      )
      .first();
    const summary = previewDialog
      .getByText(/\d+\s+selected\s+of\s+\d+\s+\(\d+\s+total\)/i)
      .first();
    await summary.waitFor({ state: "visible", timeout: 15_000 });
    const summaryText = (await summary.textContent())?.trim() ?? "";
    const fillPageButton = previewDialog.getByRole("button", {
      name: /Fill Page/i,
    });
    const preview = {
      ...parsePreviewSummary(summaryText),
      fillPageAvailable: await fillPageButton.isVisible().catch(() => false),
    };
    const targetIds = new Set(input.setBatch.records.map((record) => record.id));

    return {
      preview,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        type: "listing-batch-result",
        batchId: input.fullBatch.batchId,
        mode: "dry-run",
        status: "not-run",
        pageContext: input.pageContext,
        results: input.fullBatch.records.map((record) => ({
          recordId: record.id,
          status: "not-run",
          message: targetIds.has(record.id)
            ? "CSV was staged in the extension preview; Fill Page was not clicked."
            : "Record belongs to a different expansion and was not staged in this run.",
        })),
        errors: [],
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
