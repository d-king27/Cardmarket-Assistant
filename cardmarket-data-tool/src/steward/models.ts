import type { InventoryCard, InventoryCollection, InventoryFilters } from "../models/inventory";

export type StewardScope = "all" | "filtered" | "selected";
export type PredicateField = keyof Pick<
  InventoryCard,
  | "name"
  | "setCode"
  | "setName"
  | "collectorNumber"
  | "finish"
  | "rarity"
  | "quantity"
  | "purchasePrice"
  | "purchasePriceCurrency"
  | "condition"
  | "language"
  | "targetPrice"
  | "notes"
>;

export type PredicateOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "less_than"
  | "less_than_or_equal"
  | "greater_than"
  | "greater_than_or_equal"
  | "is_empty"
  | "is_not_empty";

export type InventoryPredicate =
  | {
      type: "condition";
      field: PredicateField;
      operator: PredicateOperator;
      value?: string | number | boolean | null | Array<string | number>;
    }
  | { type: "and"; predicates: InventoryPredicate[] }
  | { type: "or"; predicates: InventoryPredicate[] }
  | { type: "not"; predicate: InventoryPredicate }
  | { type: "all" }
  | { type: "selected" }
  | { type: "currently_filtered" };

export type SortableInventoryField =
  | "name"
  | "setCode"
  | "setName"
  | "collectorNumber"
  | "finish"
  | "rarity"
  | "quantity"
  | "condition"
  | "language"
  | "purchasePrice"
  | "targetPrice";

export type BatchGroupingField = "setCode" | "setName" | "rarity" | "finish" | "language" | "condition";

export type StewardOperation =
  | { type: "set_view_filter"; predicate: InventoryPredicate }
  | {
      type: "sort";
      fields: Array<{ field: SortableInventoryField; direction: "asc" | "desc" }>;
      target: "view" | "export";
    }
  | {
      type: "set_field";
      predicate: InventoryPredicate;
      field: "quantity" | "condition" | "language" | "purchasePrice" | "purchasePriceCurrency" | "targetPrice" | "notes";
      value: string | number | null;
    }
  | {
      type: "adjust_number";
      predicate: InventoryPredicate;
      field: "quantity" | "purchasePrice" | "targetPrice";
      adjustment:
        | { mode: "add"; value: number }
        | { mode: "subtract"; value: number }
        | { mode: "multiply"; value: number }
        | { mode: "percentage"; value: number };
      rounding?: { mode: "nearest" | "up" | "down"; increment: number };
      minimum?: number;
      maximum?: number;
    }
  | {
      type: "round_number";
      predicate: InventoryPredicate;
      field: "purchasePrice" | "targetPrice";
      mode: "nearest" | "up" | "down";
      increment: number;
    }
  | { type: "remove_records"; predicate: InventoryPredicate }
  | {
      type: "transfer_records";
      predicate: InventoryPredicate;
      destinationCollectionName: string;
      mode: "copy" | "move";
    }
  | {
      type: "create_batches";
      source: StewardScope;
      predicate?: InventoryPredicate;
      groupBy: BatchGroupingField[];
      sortBy: Array<{ field: SortableInventoryField; direction: "asc" | "desc" }>;
      maximumRows: number;
      separateFiles: boolean;
      cardmarketMode: boolean;
      namingTemplate?: string;
    }
  | {
      type: "split_collection";
      source: StewardScope;
      predicate?: InventoryPredicate;
      groupBy: BatchGroupingField[];
      maximumRows?: number;
      namingTemplate?: string;
      cardmarketMode: boolean;
      mode: "copy" | "move";
    }
  | {
      type: "prepare_export";
      source: StewardScope | "batch";
      excludeInvalidRows: boolean;
      sortBy: Array<{ field: SortableInventoryField; direction: "asc" | "desc" }>;
    };

export interface StewardWarning {
  code: string;
  message: string;
}

export interface StewardPlan {
  id: string;
  title: string;
  summary: string;
  userRequest: string;
  operations: StewardOperation[];
  warnings: StewardWarning[];
  assumptions: string[];
}

export type StewardResponse =
  | { type: "plan"; plan: StewardPlan }
  | { type: "clarification"; question: string; options?: string[] }
  | {
      type: "unsupported";
      message: string;
      reason: "external_data_required" | "operation_not_supported" | "ambiguous_request" | "unsafe_request";
    };

export interface FieldChange {
  cardId: string;
  cardName: string;
  field: keyof InventoryCard | "row";
  before: unknown;
  after: unknown;
}

export interface PlannedCollection {
  id: string;
  name: string;
  recordCount: number;
  totalQuantity: number;
  groupValues: Record<string, string>;
  sourceCardIds: string[];
  filename: string;
  warnings: string[];
}

export interface OperationPreview {
  operationId: string;
  operationType: StewardOperation["type"];
  matchedRecordCount: number;
  changedRecordCount: number;
  unchangedRecordCount: number;
  validationErrorCount: number;
  sampleChanges: FieldChange[];
  allChanges: FieldChange[];
  warnings: string[];
  destructive: boolean;
  plannedCollections: PlannedCollection[];
}

export interface StewardChangeSet {
  beforeCards: InventoryCard[];
  afterCards: InventoryCard[];
  createdCollections: InventoryCollection[];
  removedCardIds: string[];
}

export interface StewardAuditEntry {
  id: string;
  collectionId: string;
  createdAt: string;
  userRequest: string;
  promptVersion: string;
  model: string;
  plan: StewardPlan;
  changeSet: StewardChangeSet;
  status: "applied" | "undone";
  undoneAt?: string;
}

export interface StewardRuntimeContext {
  collection: InventoryCollection;
  cards: InventoryCard[];
  filteredCards: InventoryCard[];
  selectedCardIds: string[];
  filters: InventoryFilters;
  existingCollections: InventoryCollection[];
}

export interface StewardPlanRequest {
  request: string;
  scope: StewardScope;
  context: CollectionSummaryContext;
}

export interface CollectionSummaryContext {
  collectionId: string;
  collectionName: string;
  recordCount: number;
  totalQuantity: number;
  selectedCount: number;
  currentFilters: InventoryFilters;
  facets: {
    sets: Array<{ code: string; name: string; recordCount: number }>;
    rarities: string[];
    conditions: string[];
    languages: string[];
    finishes: string[];
    currencies: string[];
  };
  statistics: {
    purchasePrice: NumericSummary | null;
    targetPrice: NumericSummary | null;
    errorCount: number;
    warningCount: number;
  };
}

export interface NumericSummary {
  minimum: number;
  maximum: number;
  average: number;
  populatedCount: number;
}
