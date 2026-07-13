import type { InventoryCard } from "../models/inventory";
import type { InventoryPredicate, PredicateField, PredicateOperator, StewardRuntimeContext } from "./models";

const numericFields = new Set<PredicateField>(["quantity", "purchasePrice", "targetPrice"]);
const stringFields = new Set<PredicateField>([
  "name",
  "setCode",
  "setName",
  "collectorNumber",
  "finish",
  "rarity",
  "purchasePriceCurrency",
  "condition",
  "language",
  "notes",
]);

export function evaluatePredicate(
  predicate: InventoryPredicate,
  card: InventoryCard,
  context: StewardRuntimeContext,
): boolean {
  switch (predicate.type) {
    case "all":
      return true;
    case "selected":
      return context.selectedCardIds.includes(card.id);
    case "currently_filtered":
      return context.filteredCards.some((filteredCard) => filteredCard.id === card.id);
    case "and":
      return predicate.predicates.every((child) => evaluatePredicate(child, card, context));
    case "or":
      return predicate.predicates.some((child) => evaluatePredicate(child, card, context));
    case "not":
      return !evaluatePredicate(predicate.predicate, card, context);
    case "condition":
      assertOperatorAllowed(predicate.field, predicate.operator);
      return evaluateCondition(predicate.field, predicate.operator, card[predicate.field], predicate.value);
  }
}

export function filterByPredicate(
  cards: InventoryCard[],
  predicate: InventoryPredicate,
  context: StewardRuntimeContext,
): InventoryCard[] {
  return cards.filter((card) => evaluatePredicate(predicate, card, context));
}

export function assertOperatorAllowed(field: PredicateField, operator: PredicateOperator): void {
  const emptyOperators = operator === "is_empty" || operator === "is_not_empty";
  if (emptyOperators) return;

  if (numericFields.has(field)) {
    const allowed = [
      "equals",
      "not_equals",
      "in",
      "not_in",
      "less_than",
      "less_than_or_equal",
      "greater_than",
      "greater_than_or_equal",
    ];
    if (!allowed.includes(operator)) {
      throw new Error(`Operator ${operator} is not valid for numeric field ${field}.`);
    }
    return;
  }

  if (stringFields.has(field)) {
    const allowed = ["equals", "not_equals", "contains", "starts_with", "ends_with", "in", "not_in"];
    if (!allowed.includes(operator)) {
      throw new Error(`Operator ${operator} is not valid for text field ${field}.`);
    }
    return;
  }

  throw new Error(`Unsupported predicate field ${field}.`);
}

function evaluateCondition(
  field: PredicateField,
  operator: PredicateOperator,
  rawFieldValue: unknown,
  rawExpectedValue: unknown,
): boolean {
  if (operator === "is_empty") {
    return rawFieldValue === null || rawFieldValue === undefined || String(rawFieldValue).trim() === "";
  }

  if (operator === "is_not_empty") {
    return rawFieldValue !== null && rawFieldValue !== undefined && String(rawFieldValue).trim() !== "";
  }

  if (numericFields.has(field)) {
    return evaluateNumeric(operator, rawFieldValue, rawExpectedValue);
  }

  return evaluateString(operator, rawFieldValue, rawExpectedValue);
}

function evaluateNumeric(operator: PredicateOperator, rawFieldValue: unknown, rawExpectedValue: unknown): boolean {
  const fieldValue = typeof rawFieldValue === "number" ? rawFieldValue : null;
  if (fieldValue === null) return false;

  if (operator === "in" || operator === "not_in") {
    const values = Array.isArray(rawExpectedValue) ? rawExpectedValue.map(Number) : [];
    const matches = values.includes(fieldValue);
    return operator === "in" ? matches : !matches;
  }

  const expectedValue = Number(rawExpectedValue);
  if (Number.isNaN(expectedValue)) return false;

  switch (operator) {
    case "equals":
      return fieldValue === expectedValue;
    case "not_equals":
      return fieldValue !== expectedValue;
    case "less_than":
      return fieldValue < expectedValue;
    case "less_than_or_equal":
      return fieldValue <= expectedValue;
    case "greater_than":
      return fieldValue > expectedValue;
    case "greater_than_or_equal":
      return fieldValue >= expectedValue;
    default:
      return false;
  }
}

function evaluateString(operator: PredicateOperator, rawFieldValue: unknown, rawExpectedValue: unknown): boolean {
  const fieldValue = String(rawFieldValue ?? "").toLowerCase();

  if (operator === "in" || operator === "not_in") {
    const values = Array.isArray(rawExpectedValue)
      ? rawExpectedValue.map((value) => String(value).toLowerCase())
      : [];
    const matches = values.includes(fieldValue);
    return operator === "in" ? matches : !matches;
  }

  const expectedValue = String(rawExpectedValue ?? "").toLowerCase();
  switch (operator) {
    case "equals":
      return fieldValue === expectedValue;
    case "not_equals":
      return fieldValue !== expectedValue;
    case "contains":
      return fieldValue.includes(expectedValue);
    case "starts_with":
      return fieldValue.startsWith(expectedValue);
    case "ends_with":
      return fieldValue.endsWith(expectedValue);
    default:
      return false;
  }
}
