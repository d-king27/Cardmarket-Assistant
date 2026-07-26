import type { ValidationIssue, ValidationStatus } from "./validation";

export interface InventoryCard {
  id: string;
  collectionId: string;
  sourceRow: number;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  finish: string;
  rarity: string;
  quantity: number;
  manaBoxId: string | null;
  scryfallId: string | null;
  purchasePrice: number | null;
  purchasePriceCurrency: string | null;
  misprint: boolean;
  altered: boolean;
  condition: string;
  language: string;
  addedAt: string | null;
  targetPrice: number | null;
  notes: string;
  validationIssues: ValidationIssue[];
  unknownColumns: Record<string, string>;
  updatedAt: string;
}

export interface ImportMetadata {
  id: string;
  collectionId: string;
  filename: string;
  importedAt: string;
  modifiedAt: string;
  recordCount: number;
}

export interface InventoryCollection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryFilters {
  setCode: string;
  rarity: string;
  condition: string;
  language: string;
  finish: string;
  validationStatus: "" | ValidationStatus | "duplicate";
}

export const emptyFilters: InventoryFilters = {
  setCode: "",
  rarity: "",
  condition: "",
  language: "",
  finish: "",
  validationStatus: "",
};
