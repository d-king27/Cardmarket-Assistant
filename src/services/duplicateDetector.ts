import type { InventoryCard } from "../models/inventory";
import type { ValidationIssue } from "../models/validation";
import { validateInventoryCard } from "./inventoryValidator";

const duplicateIssue: ValidationIssue = {
  field: "row",
  severity: "warning",
  code: "potential_duplicate",
  message: "Potential duplicate row. Review before exporting or listing.",
};

export function duplicateKey(card: InventoryCard): string {
  const finish = card.finish.trim().toLowerCase();
  const condition = card.condition.trim().toLowerCase();
  const language = card.language.trim().toLowerCase();

  if (card.scryfallId) {
    return ["scryfall", card.scryfallId.trim().toLowerCase(), finish, condition, language].join(
      "|",
    );
  }

  return [
    "fallback",
    card.setCode.trim().toLowerCase(),
    card.collectorNumber.trim().toLowerCase(),
    finish,
    condition,
    language,
  ].join("|");
}

export function applyValidationAndDuplicateWarnings(cards: InventoryCard[]): InventoryCard[] {
  const counts = new Map<string, number>();
  cards.forEach((card) => counts.set(duplicateKey(card), (counts.get(duplicateKey(card)) ?? 0) + 1));

  return cards.map((card) => {
    const preservedIssues = card.validationIssues.filter(
      (issue) =>
        !issue.code.startsWith("potential_duplicate") &&
        ![
          "name_required",
          "set_code_required",
          "collector_number_required",
          "quantity_invalid",
          "purchase_price_invalid",
          "target_price_invalid",
          "scryfall_id_invalid",
          "currency_invalid",
          "added_at_invalid",
          "integer_invalid",
          "decimal_invalid",
        ].includes(issue.code),
    );
    const issues = [...preservedIssues, ...validateInventoryCard(card)];
    if ((counts.get(duplicateKey(card)) ?? 0) > 1) {
      issues.push(duplicateIssue);
    }

    return { ...card, validationIssues: issues };
  });
}

export function isPotentialDuplicate(card: InventoryCard): boolean {
  return card.validationIssues.some((issue) => issue.code === "potential_duplicate");
}
