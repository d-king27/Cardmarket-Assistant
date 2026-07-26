import { ChevronLeft, ChevronRight, Copy, Layers, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { InventoryCollection } from "../models/inventory";

interface CollectionSidebarProps {
  collections: InventoryCollection[];
  activeCollectionId: string;
  onSelect: (collectionId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onClone: (collectionId: string) => Promise<void>;
  onDelete: (collectionId: string) => void;
}

export function CollectionSidebar({
  collections,
  activeCollectionId,
  onSelect,
  onCreate,
  onClone,
  onDelete,
}: CollectionSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newName, setNewName] = useState("");

  const create = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }

    await onCreate(trimmed);
    setNewName("");
  };

  return (
    <aside className={isCollapsed ? "collection-sidebar collapsed" : "collection-sidebar"}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Layers size={20} />
          {!isCollapsed ? <strong>Collections</strong> : null}
        </div>
        <button
          className="icon-button"
          type="button"
          title={isCollapsed ? "Expand collections" : "Collapse collections"}
          aria-label={isCollapsed ? "Expand collections" : "Collapse collections"}
          onClick={() => setIsCollapsed((current) => !current)}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {!isCollapsed ? (
        <>
          <div className="collection-list" role="list" aria-label="Collections">
            {collections.map((collection) => (
              <div
                className={
                  collection.id === activeCollectionId
                    ? "collection-list-item active"
                    : "collection-list-item"
                }
                key={collection.id}
                role="listitem"
              >
                <button type="button" onClick={() => onSelect(collection.id)}>
                  <span>{collection.name}</span>
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title={`Copy ${collection.name}`}
                  aria-label={`Copy ${collection.name}`}
                  onClick={() => void onClone(collection.id)}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button danger-icon"
                  type="button"
                  title={`Delete ${collection.name}`}
                  aria-label={`Delete ${collection.name}`}
                  onClick={() => onDelete(collection.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="sidebar-create">
            <label className="field compact-field">
              <span>New collection</span>
              <input
                value={newName}
                placeholder="Trade binder"
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            <button className="button secondary" type="button" onClick={() => void create()}>
              <Plus size={18} />
              Add
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
