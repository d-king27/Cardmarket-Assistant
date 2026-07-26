import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

import { ListingBatchMessageSchema } from "./types.js";
import type { ListingBatchMessage } from "./types.js";

const MANABOX_HEADERS = [
  "Name",
  "Set code",
  "Set name",
  "Collector number",
  "Foil",
  "Rarity",
  "Quantity",
  "ManaBox ID",
  "Scryfall ID",
  "Purchase price",
  "Misprint",
  "Altered",
  "Condition",
  "Language",
  "Purchase price currency",
  "Added",
] as const;

type ManaBoxHeader = (typeof MANABOX_HEADERS)[number];
type ManaBoxCsvRow = Record<ManaBoxHeader, string>;

function formatValidationErrors(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => {
      const location = issue.path.length === 0 ? "batch" : issue.path.join(".");
      return `${location}: ${issue.message}`;
    })
    .join("; ");
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parsePositiveInteger(value: string, rowNumber: number): number {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(
      `ManaBox CSV row ${rowNumber} has an invalid Quantity: ${value}`,
    );
  }

  return quantity;
}

function parseBoolean(
  value: string,
  column: "Misprint" | "Altered",
  rowNumber: number,
): boolean {
  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  throw new Error(
    `ManaBox CSV row ${rowNumber} has an invalid ${column} value: ${value}`,
  );
}

function safeBatchIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function loadManaBoxCsv(
  batchPath: string,
  source: string,
): Promise<ListingBatchMessage> {
  let rows: ManaBoxCsvRow[];

  try {
    rows = parse(source, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ManaBoxCsvRow[];
  } catch (error) {
    throw new Error(`Unable to parse ManaBox CSV: ${batchPath}`, {
      cause: error,
    });
  }

  if (rows.length === 0) {
    throw new Error(`ManaBox CSV contains no listing records: ${batchPath}`);
  }

  const availableHeaders = new Set(Object.keys(rows[0] ?? {}));
  const missingHeaders = MANABOX_HEADERS.filter(
    (header) => !availableHeaders.has(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `ManaBox CSV is missing required columns: ${missingHeaders.join(", ")}`,
    );
  }

  const fileStats = await stat(batchPath);
  const filename = path.basename(batchPath, path.extname(batchPath));
  const batchIdPart = safeBatchIdPart(filename) || "csv-export";
  const contentId = createHash("sha256").update(source).digest("hex").slice(0, 12);
  const candidate: ListingBatchMessage = {
    protocolVersion: 1,
    type: "listing-batch",
    batchId: `manabox-${batchIdPart}-${contentId}`,
    createdAt: fileStats.mtime.toISOString(),
    records: rows.map((row, index) => {
      const rowNumber = index + 2;
      const manaboxId = row["ManaBox ID"].trim();
      const optionalFields = {
        manaboxId: optionalText(manaboxId),
        scryfallId: optionalText(row["Scryfall ID"]),
        setCode: optionalText(row["Set code"]),
        setName: optionalText(row["Set name"]),
        collectorNumber: optionalText(row["Collector number"]),
        finish: optionalText(row.Foil),
        rarity: optionalText(row.Rarity),
        language: optionalText(row.Language),
        condition: optionalText(row.Condition),
        purchasePrice: optionalText(row["Purchase price"]),
        purchasePriceCurrency: optionalText(row["Purchase price currency"]),
        addedAt: optionalText(row.Added),
      };

      return {
        id: `manabox-${manaboxId || "row"}-${index + 1}`,
        name: row.Name,
        quantity: parsePositiveInteger(row.Quantity, rowNumber),
        ...Object.fromEntries(
          Object.entries(optionalFields).filter(([, value]) => value !== undefined),
        ),
        misprint: parseBoolean(row.Misprint, "Misprint", rowNumber),
        altered: parseBoolean(row.Altered, "Altered", rowNumber),
      };
    }),
  };

  const result = ListingBatchMessageSchema.safeParse(candidate);

  if (!result.success) {
    throw new Error(
      `Converted ManaBox CSV validation failed: ${formatValidationErrors(result.error.issues)}`,
    );
  }

  return result.data;
}

function loadJsonBatch(batchPath: string, source: string): ListingBatchMessage {
  let candidate: unknown;

  try {
    candidate = JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`Batch file is not valid JSON: ${batchPath}`, {
      cause: error,
    });
  }

  const result = ListingBatchMessageSchema.safeParse(candidate);

  if (!result.success) {
    throw new Error(
      `Batch validation failed: ${formatValidationErrors(result.error.issues)}`,
    );
  }

  return result.data;
}

export async function loadBatch(
  batchPath: string,
): Promise<ListingBatchMessage> {
  let source: string;

  try {
    source = await readFile(batchPath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read batch file at ${batchPath}`, { cause: error });
  }

  const extension = path.extname(batchPath).toLowerCase();

  if (extension === ".csv") {
    return loadManaBoxCsv(batchPath, source);
  }

  if (extension === ".json") {
    return loadJsonBatch(batchPath, source);
  }

  throw new Error(
    `Unsupported batch file extension: ${extension || "(none)"}. Use .csv or .json`,
  );
}
