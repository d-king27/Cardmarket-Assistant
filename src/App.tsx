import type { RowSelectionState } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { CollectionSidebar } from "./components/CollectionSidebar";
import { CsvImport } from "./components/CsvImport";
import { EditCardPanel } from "./components/EditCardPanel";
import { InventoryFilters } from "./components/InventoryFilters";
import { InventoryTable } from "./components/InventoryTable";
import { useInventory } from "./hooks/useInventory";
import type { InventoryCard, InventoryFilters as InventoryFiltersModel } from "./models/inventory";
import { emptyFilters } from "./models/inventory";
import { isPotentialDuplicate } from "./services/duplicateDetector";

type PendingConfirmation =
  | { type: "remove"; ids: string[] }
  | { type: "clear" }
  | { type: "deleteCollection"; id: string }
  | null;

export default function App() {
  const inventory = useInventory();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<InventoryFiltersModel>(emptyFilters);
  const [selectedRows, setSelectedRows] = useState<RowSelectionState>({});
  const [editingCard, setEditingCard] = useState<InventoryCard | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);

  const filteredCards = useMemo(
    () => filterCards(inventory.cards, search, filters),
    [inventory.cards, search, filters],
  );

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) {
      return;
    }

    if (pendingConfirmation.type === "remove") {
      await inventory.removeCards(pendingConfirmation.ids);
      setSelectedRows({});
    } else if (pendingConfirmation.type === "clear") {
      await inventory.clearInventory();
      setSearch("");
      setFilters(emptyFilters);
      setSelectedRows({});
      setEditingCard(null);
    } else {
      await inventory.deleteCollection(pendingConfirmation.id);
      setSearch("");
      setFilters(emptyFilters);
      setSelectedRows({});
      setEditingCard(null);
    }
    setPendingConfirmation(null);
  };

  return (
    <main className="app-shell">
      <CsvImport
        onImport={inventory.importInventory}
      />
      {inventory.error ? <p className="notice error-text">{inventory.error}</p> : null}

      {inventory.collections.length > 0 ? (
        <div className="workspace-layout">
          <CollectionSidebar
            collections={inventory.collections}
            activeCollectionId={inventory.activeCollectionId}
            onSelect={(collectionId) => {
              setSelectedRows({});
              setEditingCard(null);
              inventory.setActiveCollectionId(collectionId);
            }}
            onCreate={inventory.createCollection}
            onClone={inventory.cloneCollection}
            onDelete={(id) => setPendingConfirmation({ type: "deleteCollection", id })}
          />

          <section className="inventory-workspace">
            <section className="actions-panel">
              <InventoryFilters
                cards={inventory.cards}
                filters={filters}
                search={search}
                onFiltersChange={setFilters}
                onSearchChange={setSearch}
              />
              <div className="collection-actions">
                <button
                  className="button danger"
                  type="button"
                  disabled={inventory.cards.length === 0}
                  onClick={() => setPendingConfirmation({ type: "clear" })}
                >
                  <Trash2 size={18} />
                  Clear collection
                </button>
              </div>
            </section>

            {inventory.isLoading ? (
              <section className="empty-state">
                <h2>Loading inventory</h2>
                <p>Checking local storage.</p>
              </section>
            ) : inventory.cards.length === 0 ? (
              <section className="empty-state">
                <h2>No records in this collection</h2>
                <p>Import a ManaBox CSV to populate the selected collection.</p>
              </section>
            ) : (
              <InventoryTable
                cards={filteredCards}
                selectedRows={selectedRows}
                onSelectedRowsChange={setSelectedRows}
                onEdit={setEditingCard}
                onRemoveSelected={(ids) => setPendingConfirmation({ type: "remove", ids })}
              />
            )}
          </section>
        </div>
      ) : null}

      {inventory.collections.length > 0 ? (
        <>
          <EditCardPanel
            card={editingCard}
            onSave={inventory.updateCard}
            onClose={() => setEditingCard(null)}
          />
          <ConfirmationDialog
            isOpen={pendingConfirmation !== null}
            title={
              pendingConfirmation?.type === "clear"
                ? "Clear collection"
                : pendingConfirmation?.type === "deleteCollection"
                  ? "Delete collection"
                  : "Remove selected records"
            }
            message={
              pendingConfirmation?.type === "clear"
                ? "This permanently removes the records in the active collection from this browser."
                : pendingConfirmation?.type === "deleteCollection"
                  ? "This permanently deletes the collection and all of its locally stored records."
                  : "This permanently removes the selected records from the active collection."
            }
            confirmLabel={
              pendingConfirmation?.type === "clear"
                ? "Clear collection"
                : pendingConfirmation?.type === "deleteCollection"
                  ? "Delete collection"
                  : "Remove records"
            }
            onConfirm={() => void confirmPendingAction()}
            onCancel={() => setPendingConfirmation(null)}
          />
        </>
      ) : null}
    </main>
  );
}

function filterCards(cards: InventoryCard[], search: string, filters: InventoryFiltersModel) {
  const normalizedSearch = search.trim().toLowerCase();

  return cards.filter((card) => {
    if (filters.setCode && card.setCode !== filters.setCode) return false;
    if (filters.rarity && card.rarity !== filters.rarity) return false;
    if (filters.condition && card.condition !== filters.condition) return false;
    if (filters.language && card.language !== filters.language) return false;
    if (filters.finish && card.finish !== filters.finish) return false;
    if (filters.validationStatus === "duplicate" && !isPotentialDuplicate(card)) return false;
    if (
      filters.validationStatus === "error" &&
      !card.validationIssues.some((issue) => issue.severity === "error")
    ) {
      return false;
    }
    if (
      filters.validationStatus === "warning" &&
      !card.validationIssues.some((issue) => issue.severity === "warning")
    ) {
      return false;
    }
    if (filters.validationStatus === "valid" && card.validationIssues.length > 0) return false;

    if (!normalizedSearch) return true;

    return [card.name, card.setName, card.setCode, card.collectorNumber]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
}
