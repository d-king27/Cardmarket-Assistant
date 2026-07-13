import Papa from "papaparse";
import type { InventoryCard } from "../models/inventory";
import type { ValidationIssue } from "../models/validation";
import { applyValidationAndDuplicateWarnings } from "./duplicateDetector";

export const manaboxHeaders = [
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

const requiredHeaders = ["Name", "Set code", "Collector number", "Quantity"];
const knownHeaderSet = new Set<string>(manaboxHeaders);

export interface ParseInventoryResult {
  cards: InventoryCard[];
  missingRequiredHeaders: string[];
  unknownHeaders: string[];
  rowIssues: ValidationIssue[];
}

type CsvRow = Record<string, string>;

export function parseManaBoxCsv(csvText: string, collectionId = "default"): ParseInventoryResult {
  const cleanText = csvText.replace(/^\uFEFF/, "");
  if (!cleanText.trim()) {
    return {
      cards: [],
      missingRequiredHeaders: requiredHeaders,
      unknownHeaders: [],
      rowIssues: [
        {
          field: "row",
          severity: "error",
          code: "empty_file",
          message: "The CSV file is empty.",
        },
      ],
    };
  }

  const parsed = Papa.parse<CsvRow>(cleanText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
    transform: (value) => (typeof value === "string" ? value.trim() : value),
  });

  const headers = (parsed.meta.fields ?? []).map((header) => header.trim()).filter(Boolean);
  const missingRequiredHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  const unknownHeaders = headers.filter((header) => !knownHeaderSet.has(header));

  const rowIssues: ValidationIssue[] = parsed.errors.map((parseError) => ({
    field: "row",
    severity: "error",
    code: "malformed_csv",
    message: `Row ${parseError.row ?? "unknown"}: ${parseError.message}`,
  }));

  const cards = parsed.data
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""))
    .map((row, index) => rowToCard(row, index + 2, unknownHeaders, collectionId));

  return {
    cards: applyValidationAndDuplicateWarnings(cards),
    missingRequiredHeaders,
    unknownHeaders,
    rowIssues,
  };
}

function rowToCard(
  row: CsvRow,
  sourceRow: number,
  unknownHeaders: string[],
  collectionId: string,
): InventoryCard {
  const issues: ValidationIssue[] = [];
  const quantity = parseInteger(row.Quantity, "quantity", issues);
  const purchasePrice = parseNullableDecimal(row["Purchase price"], "purchasePrice", issues);
  const misprint = parseBoolean(row.Misprint, "misprint", issues);
  const altered = parseBoolean(row.Altered, "altered", issues);
  const unknownColumns = Object.fromEntries(
    unknownHeaders.map((header) => [header, row[header] ?? ""]),
  );

  return {
    id: createCardId(),
    collectionId,
    sourceRow,
    name: value(row.Name),
    setCode: value(row["Set code"]).toUpperCase(),
    setName: value(row["Set name"]),
    collectorNumber: value(row["Collector number"]),
    finish: value(row.Foil),
    rarity: value(row.Rarity),
    quantity,
    manaBoxId: nullable(row["ManaBox ID"]),
    scryfallId: nullable(row["Scryfall ID"]),
    purchasePrice,
    purchasePriceCurrency: nullable(row["Purchase price currency"]?.toUpperCase()),
    misprint,
    altered,
    condition: value(row.Condition),
    language: value(row.Language),
    addedAt: nullable(row.Added),
    targetPrice: null,
    notes: "",
    validationIssues: issues,
    unknownColumns,
    updatedAt: new Date().toISOString(),
  };
}

function createCardId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function value(input: string | undefined): string {
  return String(input ?? "").trim();
}

function nullable(input: string | undefined): string | null {
  const trimmed = value(input);
  return trimmed === "" ? null : trimmed;
}

function parseInteger(
  input: string | undefined,
  field: keyof InventoryCard,
  issues: ValidationIssue[],
): number {
  const trimmed = value(input);
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  issues.push({
    field,
    severity: "error",
    code: "integer_invalid",
    message: "Quantity must be a whole number of 0 or more.",
  });
  return -1;
}

function parseNullableDecimal(
  input: string | undefined,
  field: keyof InventoryCard,
  issues: ValidationIssue[],
): number | null {
  const trimmed = value(input);
  if (trimmed === "") {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }

  issues.push({
    field,
    severity: "error",
    code: "decimal_invalid",
    message: "Price must be a decimal number of 0 or more.",
  });
  return null;
}

function parseBoolean(
  input: string | undefined,
  field: keyof InventoryCard,
  issues: ValidationIssue[],
): boolean {
  const trimmed = value(input).toLowerCase();
  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false" || trimmed === "") {
    return false;
  }

  issues.push({
    field,
    severity: "warning",
    code: "boolean_invalid",
    message: "Boolean values must be true or false.",
  });
  return false;
}
