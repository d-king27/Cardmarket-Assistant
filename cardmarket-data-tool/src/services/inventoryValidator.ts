import { z } from "zod";
import type { InventoryCard } from "../models/inventory";
import type { ValidationIssue } from "../models/validation";

const uuidSchema = z.string().uuid();
const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const editableFields: Array<keyof InventoryCard> = [
  "quantity",
  "condition",
  "language",
  "purchasePrice",
  "purchasePriceCurrency",
  "targetPrice",
  "notes",
];

export function validateInventoryCard(card: InventoryCard): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!card.name.trim()) {
    issues.push(error("name", "name_required", "Name is required."));
  }

  if (!card.setCode.trim()) {
    issues.push(error("setCode", "set_code_required", "Set code is required."));
  }

  if (!card.collectorNumber.trim()) {
    issues.push(
      error(
        "collectorNumber",
        "collector_number_required",
        "Collector number is required.",
      ),
    );
  }

  if (!Number.isInteger(card.quantity) || card.quantity < 0) {
    issues.push(
      error("quantity", "quantity_invalid", "Quantity must be a whole number of 0 or more."),
    );
  }

  if (card.purchasePrice !== null && card.purchasePrice < 0) {
    issues.push(
      error("purchasePrice", "purchase_price_invalid", "Purchase price cannot be negative."),
    );
  }

  if (card.targetPrice !== null && card.targetPrice < 0) {
    issues.push(error("targetPrice", "target_price_invalid", "Target price cannot be negative."));
  }

  if (card.scryfallId && !uuidSchema.safeParse(card.scryfallId).success) {
    issues.push(warning("scryfallId", "scryfall_id_invalid", "Scryfall ID is not a valid UUID."));
  }

  if (
    card.purchasePriceCurrency &&
    !currencySchema.safeParse(card.purchasePriceCurrency).success
  ) {
    issues.push(
      warning(
        "purchasePriceCurrency",
        "currency_invalid",
        "Currency should be a three-letter code.",
      ),
    );
  }

  if (card.addedAt && Number.isNaN(Date.parse(card.addedAt))) {
    issues.push(warning("addedAt", "added_at_invalid", "Added date is not a valid date."));
  }

  return issues;
}

export function validateEditableDraft(
  draft: Pick<
    InventoryCard,
    | "quantity"
    | "condition"
    | "language"
    | "purchasePrice"
    | "purchasePriceCurrency"
    | "targetPrice"
    | "notes"
  >,
): Partial<Record<keyof InventoryCard, string>> {
  const errors: Partial<Record<keyof InventoryCard, string>> = {};

  if (!Number.isInteger(draft.quantity) || draft.quantity < 0) {
    errors.quantity = "Quantity must be a whole number of 0 or more.";
  }

  if (!draft.condition.trim()) {
    errors.condition = "Condition is required.";
  }

  if (!draft.language.trim()) {
    errors.language = "Language is required.";
  }

  if (draft.purchasePrice !== null && draft.purchasePrice < 0) {
    errors.purchasePrice = "Purchase price cannot be negative.";
  }

  if (
    draft.purchasePriceCurrency !== null &&
    draft.purchasePriceCurrency.trim() !== "" &&
    !currencySchema.safeParse(draft.purchasePriceCurrency).success
  ) {
    errors.purchasePriceCurrency = "Use a three-letter currency code.";
  }

  if (draft.targetPrice !== null && draft.targetPrice < 0) {
    errors.targetPrice = "Target price cannot be negative.";
  }

  return errors;
}

function error(field: keyof InventoryCard, code: string, message: string): ValidationIssue {
  return { field, severity: "error", code, message };
}

function warning(field: keyof InventoryCard, code: string, message: string): ValidationIssue {
  return { field, severity: "warning", code, message };
}
