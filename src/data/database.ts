import Dexie, { type EntityTable } from "dexie";
import type { ImportMetadata, InventoryCard, InventoryCollection } from "../models/inventory";
import type { StewardAuditEntry } from "../steward/models";

export class InventoryDatabase extends Dexie {
  cards!: EntityTable<InventoryCard, "id">;
  metadata!: EntityTable<ImportMetadata, "id">;
  collections!: EntityTable<InventoryCollection, "id">;
  stewardAudit!: EntityTable<StewardAuditEntry, "id">;

  constructor() {
    super("manaboxCsvManager");
    this.version(1).stores({
      cards: "id, name, setCode, rarity, condition, language, finish, updatedAt",
      metadata: "id, importedAt, modifiedAt",
    });
    this.version(2).stores({
      cards: "id, collectionId, name, setCode, rarity, condition, language, finish, updatedAt",
      metadata: "id, collectionId, importedAt, modifiedAt",
      collections: "id, name, updatedAt",
    }).upgrade(async (transaction) => {
      const now = new Date().toISOString();
      await transaction
        .table("cards")
        .toCollection()
        .modify((card) => {
          if (!card.collectionId) {
            card.collectionId = "default";
          }
        });
      await transaction.table("collections").put({
        id: "default",
        name: "Main collection",
        createdAt: now,
        updatedAt: now,
      });
    });
    this.version(3).stores({
      cards: "id, collectionId, name, setCode, rarity, condition, language, finish, updatedAt",
      metadata: "id, collectionId, importedAt, modifiedAt",
      collections: "id, name, updatedAt",
      stewardAudit: "id, collectionId, createdAt, status",
    });
  }
}

export const db = new InventoryDatabase();
