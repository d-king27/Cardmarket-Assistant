import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

import type {
  ProcessingPlanItem,
  QueueItemSource,
  QueueTarget,
  QueueValidation,
} from "./queueTypes.js";

type CsvRow = Record<string, string>;

interface FilenameTags {
  setTag?: string;
  rarity?: string;
}

export interface ExpectedQueueBatch {
  batchId: string;
  fingerprint: string;
  rowCount: number;
  totalQuantity: number;
  setCode: string;
  setName: string;
  rarity: string;
}

export interface ScanCsvFileOptions {
  expected?: ExpectedQueueBatch;
  source?: QueueItemSource;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function findHeader(headers: string[], aliases: string[]): string | undefined {
  const normalizedAliases = new Set(aliases.map(normalize));
  return headers.find((header) => normalizedAliases.has(normalize(header)));
}

function uniqueColumnValue(
  rows: CsvRow[],
  header: string | undefined,
  description: string,
): string | undefined {
  if (header === undefined) {
    return undefined;
  }

  const values = new Map<string, string>();

  for (const row of rows) {
    const value = row[header]?.trim() ?? "";
    if (value !== "") {
      values.set(normalize(value), value);
    }
  }

  if (values.size > 1) {
    throw new Error(
      `CSV contains multiple ${description} values: ${[...values.values()].join(", ")}`,
    );
  }

  return [...values.values()][0];
}

export function parseFilenameTags(fileName: string): FilenameTags {
  const baseName = path.basename(fileName, path.extname(fileName));
  const explicit = baseName.match(
    /(?:^|__)set[-=_]([^_]+?)(?:__|$).*?(?:^|__)rarity[-=_]([^_]+?)(?:__|$)/i,
  );

  if (explicit !== null) {
    const setTag = explicit[1]?.trim();
    const rarity = explicit[2]?.trim();
    return {
      ...(setTag === undefined ? {} : { setTag }),
      ...(rarity === undefined ? {} : { rarity }),
    };
  }

  const compactParts = baseName.split("__").filter((part) => part !== "");

  if (compactParts.length >= 2) {
    const setTag = compactParts.at(-2)?.replace(/^set[-=_]/i, "").trim();
    const rarity = compactParts.at(-1)?.replace(/^rarity[-=_]/i, "").trim();
    return {
      ...(setTag === undefined ? {} : { setTag }),
      ...(rarity === undefined ? {} : { rarity }),
    };
  }

  return {};
}

function validateFile(
  fileName: string,
  source: string,
): { target: QueueTarget; validation: QueueValidation } {
  let rows: CsvRow[];

  try {
    rows = parse(source, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    throw new Error(
      `CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (rows.length === 0) {
    throw new Error("CSV contains no data rows");
  }

  const headers = Object.keys(rows[0] ?? {});
  const nameHeader = findHeader(headers, ["Name"]);
  const quantityHeader = findHeader(headers, ["Quantity", "Amount"]);

  if (nameHeader === undefined || quantityHeader === undefined) {
    throw new Error("CSV must contain Name and Quantity (or Amount) columns");
  }

  let totalQuantity = 0;
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const name = row[nameHeader]?.trim() ?? "";
    const quantityText = row[quantityHeader]?.trim() ?? "";
    const quantity = Number(quantityText);

    if (name === "") {
      throw new Error(`CSV row ${rowNumber} has an empty Name`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `CSV row ${rowNumber} has an invalid ${quantityHeader}: ${quantityText}`,
      );
    }
    totalQuantity += quantity;
  }

  const setCode = uniqueColumnValue(
    rows,
    findHeader(headers, ["Set code", "Setcode"]),
    "set-code",
  );
  const setName = uniqueColumnValue(
    rows,
    findHeader(headers, ["Set name", "Expansion"]),
    "set-name",
  );
  const genericSet = uniqueColumnValue(
    rows,
    findHeader(headers, ["Set"]),
    "set",
  );
  const columnRarity = uniqueColumnValue(
    rows,
    findHeader(headers, ["Rarity"]),
    "rarity",
  );
  const filenameTags = parseFilenameTags(fileName);
  const columnSetTag = setCode ?? setName ?? genericSet;

  if (
    filenameTags.setTag !== undefined &&
    setCode !== undefined &&
    normalize(filenameTags.setTag) !== normalize(setCode)
  ) {
    throw new Error(
      `Filename set tag ${filenameTags.setTag} conflicts with CSV set code ${setCode}`,
    );
  }

  if (
    filenameTags.rarity !== undefined &&
    columnRarity !== undefined &&
    normalize(filenameTags.rarity) !== normalize(columnRarity)
  ) {
    throw new Error(
      `Filename rarity ${filenameTags.rarity} conflicts with CSV rarity ${columnRarity}`,
    );
  }

  const setTag = columnSetTag ?? filenameTags.setTag;
  const rarity = columnRarity ?? filenameTags.rarity;

  if (setTag === undefined || setTag.trim() === "") {
    throw new Error(
      "No single set tag found. Add Set code/Set name/Set column data or tag the filename as SET__RARITY.csv",
    );
  }

  if (rarity === undefined || rarity.trim() === "") {
    throw new Error(
      "No single rarity found. Add a Rarity column or tag the filename as SET__RARITY.csv",
    );
  }

  const usedColumnMetadata = columnSetTag !== undefined || columnRarity !== undefined;
  const usedFilenameMetadata =
    (columnSetTag === undefined && filenameTags.setTag !== undefined) ||
    (columnRarity === undefined && filenameTags.rarity !== undefined);
  const metadataSource = usedColumnMetadata
    ? usedFilenameMetadata
      ? "mixed"
      : "columns"
    : "filename";

  return {
    target: {
      setTag,
      ...(setCode === undefined ? {} : { setCode }),
      ...(setName === undefined ? {} : { setName }),
      rarity,
    },
    validation: {
      rowCount: rows.length,
      totalQuantity,
      headers,
      metadataSource,
    },
  };
}

function assertExpectedBatch(
  expected: ExpectedQueueBatch,
  actual: {
    fingerprint: string;
    target: QueueTarget;
    validation: QueueValidation;
  },
): void {
  if (actual.fingerprint !== expected.fingerprint) {
    throw new Error(
      `CSV fingerprint does not match manifest for batch ${expected.batchId}`,
    );
  }
  if (actual.validation.rowCount !== expected.rowCount) {
    throw new Error(
      `CSV row count ${actual.validation.rowCount} does not match manifest row count ${expected.rowCount}`,
    );
  }
  if (actual.validation.totalQuantity !== expected.totalQuantity) {
    throw new Error(
      `CSV total quantity ${actual.validation.totalQuantity ?? "unknown"} does not match manifest total quantity ${expected.totalQuantity}`,
    );
  }
  if (
    actual.target.setCode !== undefined &&
    normalize(actual.target.setCode) !== normalize(expected.setCode)
  ) {
    throw new Error(
      `CSV set code ${actual.target.setCode} does not match manifest set code ${expected.setCode}`,
    );
  }
  if (
    actual.target.setName !== undefined &&
    normalize(actual.target.setName) !== normalize(expected.setName)
  ) {
    throw new Error(
      `CSV set name ${actual.target.setName} does not match manifest set name ${expected.setName}`,
    );
  }
  if (normalize(actual.target.rarity) !== normalize(expected.rarity)) {
    throw new Error(
      `CSV rarity ${actual.target.rarity} does not match manifest rarity ${expected.rarity}`,
    );
  }
}

export async function scanCsvFile(
  filePath: string,
  options: ScanCsvFileOptions = {},
): Promise<ProcessingPlanItem> {
  const fileName = path.basename(filePath);
  const contents = await readFile(filePath);
  const sourceText = contents.toString("utf8");
  const fingerprint = createHash("sha256").update(contents).digest("hex");
  const id =
    options.expected?.batchId ??
    `${safeIdPart(fileName) || "csv"}-${fingerprint.slice(0, 10)}`;

  try {
    const { target, validation } = validateFile(fileName, sourceText);
    if (options.expected !== undefined) {
      assertExpectedBatch(options.expected, {
        fingerprint,
        target,
        validation,
      });
    }
    return {
      id,
      fileName,
      filePath,
      fingerprint,
      status: "pending",
      attempts: 0,
      target,
      validation,
      ...(options.source === undefined ? {} : { source: options.source }),
      notes: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id,
      fileName,
      filePath,
      fingerprint,
      status: "invalid",
      attempts: 0,
      validationError: message,
      ...(options.source === undefined ? {} : { source: options.source }),
      notes: [
        {
          at: new Date().toISOString(),
          kind: "failure",
          message,
        },
      ],
    };
  }
}

export async function scanCsvDirectory(
  inputDirectory: string,
): Promise<ProcessingPlanItem[]> {
  const directoryStats = await stat(inputDirectory).catch(() => null);

  if (directoryStats === null || !directoryStats.isDirectory()) {
    throw new Error(
      `CSV input directory does not exist: ${inputDirectory}. Create it and add CSV files first.`,
    );
  }

  const entries = await readdir(inputDirectory, { withFileTypes: true });
  const csvPaths = entries
    .filter(
      (entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".csv",
    )
    .map((entry) => path.join(inputDirectory, entry.name))
    .sort((left, right) =>
      path.basename(left).localeCompare(path.basename(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  if (csvPaths.length === 0) {
    throw new Error(`No CSV files found in ${inputDirectory}`);
  }

  return Promise.all(csvPaths.map((csvPath) => scanCsvFile(csvPath)));
}
