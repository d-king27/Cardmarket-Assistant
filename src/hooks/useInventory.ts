import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImportMetadata, InventoryCard, InventoryCollection } from "../models/inventory";
import { db } from "../data/database";
import { applyValidationAndDuplicateWarnings } from "../services/duplicateDetector";
import { exportInventoryToCsv } from "../services/csvExporter";
import { latestUndoableAudit, markAuditUndone } from "../steward/auditLog";
import { executeApprovedPlan } from "../steward/operationExecutor";
import type { StewardAuditEntry, StewardPlan, StewardRuntimeContext } from "../steward/models";

const defaultCollectionId = "default";

export function useInventory() {
  const [cards, setCards] = useState<InventoryCard[]>([]);
  const [collections, setCollections] = useState<InventoryCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState(defaultCollectionId);
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [auditEntries, setAuditEntries] = useState<StewardAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInventory = cards.length > 0;
  const activeCollection =
    collections.find((collection) => collection.id === activeCollectionId) ?? null;

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [storedCards, storedMetadata, storedCollections] = await Promise.all([
        db.cards.where("collectionId").equals(activeCollectionId).toArray(),
        db.metadata.get(activeCollectionId),
        db.collections.toArray(),
      ]);
      const storedAudit = await db.stewardAudit.where("collectionId").equals(activeCollectionId).toArray();
      const validated = applyValidationAndDuplicateWarnings(storedCards);
      setCards(validated);
      setCollections(storedCollections.sort((left, right) => left.name.localeCompare(right.name)));
      setMetadata(storedMetadata ?? null);
      setAuditEntries(storedAudit.sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      setError(null);
    } catch (caught) {
      console.error("Failed to load inventory", caught);
      setError("Could not load the local inventory.");
    } finally {
      setIsLoading(false);
    }
  }, [activeCollectionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectCollection = useCallback((collectionId: string) => {
    setCards([]);
    setMetadata(null);
    setAuditEntries([]);
    setActiveCollectionId(collectionId);
  }, []);

  const importInventory = useCallback(async (nextCards: InventoryCard[], filename: string) => {
    const now = new Date().toISOString();
    const collectionId = createId();
    const nextCollection: InventoryCollection = {
      id: collectionId,
      name: makeCollectionName(filename, collections),
      createdAt: now,
      updatedAt: now,
    };
    const validated = applyValidationAndDuplicateWarnings(nextCards).map((card) => ({
      ...card,
      collectionId,
      updatedAt: now,
    }));
    const nextMetadata: ImportMetadata = {
      id: collectionId,
      collectionId,
      filename,
      importedAt: now,
      modifiedAt: now,
      recordCount: validated.length,
    };

    try {
      await db.transaction("rw", db.cards, db.metadata, db.collections, async () => {
        await db.cards.bulkPut(validated);
        await db.metadata.put(nextMetadata);
        await db.collections.put(nextCollection);
      });
      setCards(validated);
      setMetadata(nextMetadata);
      setCollections((current) => upsertCollection(current, nextCollection));
      setActiveCollectionId(nextCollection.id);
      setError(null);
    } catch (caught) {
      console.error("Failed to save imported inventory", caught);
      setError("Could not save the imported inventory locally.");
    }
  }, [collections]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<InventoryCard>) => {
    const now = new Date().toISOString();
    const nextCards = applyValidationAndDuplicateWarnings(
      cards.map((card) => (card.id === cardId ? { ...card, ...updates, updatedAt: now } : card)),
    );
    const updatedCard = nextCards.find((card) => card.id === cardId);
    const nextMetadata = metadata
      ? { ...metadata, modifiedAt: now, recordCount: nextCards.length }
      : null;
    const nextCollection = activeCollection ? { ...activeCollection, updatedAt: now } : null;

    if (!updatedCard) {
      return;
    }

    try {
      await db.transaction("rw", db.cards, db.metadata, db.collections, async () => {
        await db.cards.bulkPut(nextCards);
        if (nextMetadata) {
          await db.metadata.put(nextMetadata);
        }
        if (nextCollection) {
          await db.collections.put(nextCollection);
        }
      });
      setCards(nextCards);
      setMetadata(nextMetadata);
      if (nextCollection) {
        setCollections((current) => upsertCollection(current, nextCollection));
      }
      setError(null);
    } catch (caught) {
      console.error("Failed to update card", caught);
      setError("Could not save the card changes.");
    }
  }, [activeCollection, cards, metadata]);

  const removeCards = useCallback(async (cardIds: string[]) => {
    const now = new Date().toISOString();
    const idSet = new Set(cardIds);
    const nextCards = applyValidationAndDuplicateWarnings(cards.filter((card) => !idSet.has(card.id)));
    const nextMetadata = metadata
      ? { ...metadata, modifiedAt: now, recordCount: nextCards.length }
      : null;
    const nextCollection = activeCollection ? { ...activeCollection, updatedAt: now } : null;

    try {
      await db.transaction("rw", db.cards, db.metadata, db.collections, async () => {
        await db.cards.bulkDelete(cardIds);
        if (nextMetadata) {
          await db.metadata.put(nextMetadata);
        }
        if (nextCollection) {
          await db.collections.put(nextCollection);
        }
      });
      setCards(nextCards);
      setMetadata(nextMetadata);
      if (nextCollection) {
        setCollections((current) => upsertCollection(current, nextCollection));
      }
      setError(null);
    } catch (caught) {
      console.error("Failed to remove cards", caught);
      setError("Could not remove the selected records.");
    }
  }, [activeCollection, cards, metadata]);

  const clearInventory = useCallback(async () => {
    try {
      await db.transaction("rw", db.cards, db.metadata, async () => {
        await db.cards.where("collectionId").equals(activeCollectionId).delete();
        await db.metadata.delete(activeCollectionId);
      });
      setCards([]);
      setMetadata(null);
      setError(null);
    } catch (caught) {
      console.error("Failed to clear inventory", caught);
      setError("Could not clear the local inventory.");
    }
  }, [activeCollectionId]);

  const createCollection = useCallback(async (name: string) => {
    const now = new Date().toISOString();
    const collection: InventoryCollection = {
      id: createId(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.collections.put(collection);
      setCollections((current) => upsertCollection(current, collection));
      setCards([]);
      setMetadata(null);
      setAuditEntries([]);
      setActiveCollectionId(collection.id);
      setError(null);
    } catch (caught) {
      console.error("Failed to create collection", caught);
      setError("Could not create the collection.");
    }
  }, []);

  const renameCollection = useCallback(async (collectionId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const existing = collections.find((collection) => collection.id === collectionId);
    if (!existing) {
      return;
    }

    const renamed = { ...existing, name: trimmed, updatedAt: new Date().toISOString() };
    try {
      await db.collections.put(renamed);
      setCollections((current) => upsertCollection(current, renamed));
      setError(null);
    } catch (caught) {
      console.error("Failed to rename collection", caught);
      setError("Could not rename the collection.");
    }
  }, [collections]);

  const deleteCollection = useCallback(async (collectionId: string) => {
    const remaining = collections.filter((collection) => collection.id !== collectionId);
    const nextActiveId = remaining[0]?.id ?? defaultCollectionId;

    try {
      await db.transaction("rw", db.cards, db.metadata, db.collections, async () => {
        await db.cards.where("collectionId").equals(collectionId).delete();
        await db.metadata.delete(collectionId);
        await db.collections.delete(collectionId);
      });
      setCollections(remaining.sort((left, right) => left.name.localeCompare(right.name)));
      setCards([]);
      setMetadata(null);
      setAuditEntries([]);
      setActiveCollectionId(nextActiveId);
      setError(null);
    } catch (caught) {
      console.error("Failed to delete collection", caught);
      setError("Could not delete the collection.");
    }
  }, [collections]);

  const cloneCollection = useCallback(async (collectionId: string) => {
    const sourceCollection = collections.find((collection) => collection.id === collectionId);
    if (!sourceCollection) {
      return;
    }

    const now = new Date().toISOString();
    const clonedCollection: InventoryCollection = {
      id: createId(),
      name: makeUniqueName(`${sourceCollection.name} copy`, collections),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const sourceCards = await db.cards.where("collectionId").equals(collectionId).toArray();
      const clonedCards = applyValidationAndDuplicateWarnings(
        sourceCards.map((card) => ({
          ...card,
          id: createId(),
          collectionId: clonedCollection.id,
          updatedAt: now,
        })),
      );
      const sourceMetadata = await db.metadata.get(collectionId);
      const clonedMetadata: ImportMetadata = {
        id: clonedCollection.id,
        collectionId: clonedCollection.id,
        filename: sourceMetadata?.filename ?? `${sourceCollection.name}.csv`,
        importedAt: now,
        modifiedAt: now,
        recordCount: clonedCards.length,
      };

      await db.transaction("rw", db.cards, db.metadata, db.collections, async () => {
        await db.collections.put(clonedCollection);
        if (clonedCards.length > 0) {
          await db.cards.bulkPut(clonedCards);
        }
        await db.metadata.put(clonedMetadata);
      });
      setCollections((current) => upsertCollection(current, clonedCollection));
      setCards(clonedCards);
      setMetadata(clonedMetadata);
      setAuditEntries([]);
      setActiveCollectionId(clonedCollection.id);
      setError(null);
    } catch (caught) {
      console.error("Failed to clone collection", caught);
      setError("Could not copy the collection.");
    }
  }, [collections]);

  const exportActiveCollection = useCallback(() => {
    if (!activeCollection || cards.length === 0) {
      return;
    }

    const csv = exportInventoryToCsv(cards);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(activeCollection.name)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeCollection, cards]);

  const exportCollection = useCallback(async (collectionId: string) => {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) return;

    try {
      const collectionCards =
        collectionId === activeCollectionId
          ? cards
          : await db.cards.where("collectionId").equals(collectionId).toArray();
      if (collectionCards.length === 0) return;

      const csv = exportInventoryToCsv(collectionCards);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug(collection.name)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      console.error("Failed to export collection", caught);
      setError("Could not export the collection.");
    }
  }, [activeCollectionId, cards, collections]);

  const applyStewardPlan = useCallback(async (
    plan: StewardPlan,
    runtimeContext: Omit<StewardRuntimeContext, "cards" | "collection" | "existingCollections">,
  ) => {
    if (!activeCollection) return;

    const result = executeApprovedPlan({
      plan,
      context: {
        ...runtimeContext,
        cards,
        collection: activeCollection,
        existingCollections: collections,
      },
      promptVersion: "phase2-v1",
      model: "local-deterministic",
    });

    try {
      await db.transaction("rw", db.cards, db.collections, db.stewardAudit, async () => {
        if (result.auditEntry.changeSet.createdCollections.length > 0) {
          await db.collections.bulkPut(result.auditEntry.changeSet.createdCollections);
          const createdCards = result.auditEntry.changeSet.afterCards.filter((card) =>
            result.auditEntry.changeSet.createdCollections.some((collection) => collection.id === card.collectionId),
          );
          if (createdCards.length > 0) await db.cards.bulkPut(createdCards);
        }
        await db.stewardAudit.put(result.auditEntry);
      });
      setCollections(result.collections.sort((left, right) => left.name.localeCompare(right.name)));
      setAuditEntries((current) => [result.auditEntry, ...current]);
      setError(null);
    } catch (caught) {
      console.error("Failed to apply Steward plan", caught);
      setError("Could not apply the Steward plan.");
    }
  }, [activeCollection, cards, collections]);

  const undoLatestStewardAction = useCallback(async () => {
    const undoable = latestUndoableAudit(auditEntries, activeCollectionId);
    if (!undoable) return;

    const undone = markAuditUndone(undoable);
    const createdIds = undoable.changeSet.createdCollections.map((collection) => collection.id);

    try {
      await db.transaction("rw", db.cards, db.collections, db.stewardAudit, async () => {
        for (const collectionId of createdIds) {
          await db.cards.where("collectionId").equals(collectionId).delete();
          await db.collections.delete(collectionId);
        }
        await db.stewardAudit.put(undone);
      });
      setCollections((current) => current.filter((collection) => !createdIds.includes(collection.id)));
      setAuditEntries((current) => current.map((entry) => (entry.id === undone.id ? undone : entry)));
      setError(null);
    } catch (caught) {
      console.error("Failed to undo Steward action", caught);
      setError("Could not undo the latest Steward action.");
    }
  }, [activeCollectionId, auditEntries]);

  return useMemo(
    () => ({
      cards,
      collections,
      activeCollection,
      activeCollectionId,
      metadata,
      auditEntries,
      isLoading,
      error,
      hasInventory,
      setActiveCollectionId: selectCollection,
      createCollection,
      renameCollection,
      deleteCollection,
      cloneCollection,
      exportActiveCollection,
      exportCollection,
      applyStewardPlan,
      undoLatestStewardAction,
      importInventory,
      updateCard,
      removeCards,
      clearInventory,
    }),
    [
      cards,
      collections,
      activeCollection,
      activeCollectionId,
      metadata,
      auditEntries,
      isLoading,
      error,
      hasInventory,
      selectCollection,
      createCollection,
      renameCollection,
      deleteCollection,
      cloneCollection,
      exportActiveCollection,
      exportCollection,
      applyStewardPlan,
      undoLatestStewardAction,
      importInventory,
      updateCard,
      removeCards,
      clearInventory,
    ],
  );
}

function upsertCollection(
  collections: InventoryCollection[],
  collection: InventoryCollection,
): InventoryCollection[] {
  const withoutExisting = collections.filter((item) => item.id !== collection.id);
  return [...withoutExisting, collection].sort((left, right) => left.name.localeCompare(right.name));
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `collection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection";
}

function makeCollectionName(filename: string, collections: InventoryCollection[]): string {
  const baseName = filename.replace(/\.[^/.]+$/, "").trim() || "Main collection";
  return makeUniqueName(collections.length === 0 ? "Main collection" : baseName, collections);
}

function makeUniqueName(baseName: string, collections: InventoryCollection[]): string {
  const existingNames = new Set(collections.map((collection) => collection.name.toLowerCase()));
  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (existingNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }

  return candidate;
}
