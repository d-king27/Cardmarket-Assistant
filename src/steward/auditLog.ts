import type { StewardAuditEntry } from "./models";

export function latestUndoableAudit(entries: StewardAuditEntry[], collectionId: string): StewardAuditEntry | null {
  return (
    entries
      .filter((entry) => entry.collectionId === collectionId && entry.status === "applied")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function markAuditUndone(entry: StewardAuditEntry, undoneAt = new Date().toISOString()): StewardAuditEntry {
  return { ...entry, status: "undone", undoneAt };
}
