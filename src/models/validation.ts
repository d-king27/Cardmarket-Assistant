import type { InventoryCard } from "./inventory";

export interface ValidationIssue {
  field: keyof InventoryCard | "row";
  severity: "warning" | "error";
  code: string;
  message: string;
}

export type ValidationStatus = "valid" | "warning" | "error";
