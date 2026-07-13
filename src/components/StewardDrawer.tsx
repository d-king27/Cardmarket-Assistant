import { Bot, CheckCircle2, Download, History, Sparkles, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { InventoryCard, InventoryCollection, InventoryFilters } from "../models/inventory";
import { requestStewardPlan } from "../services/stewardApi";
import { buildCollectionSummaryContext } from "../steward/collectionContext";
import type { OperationPreview, StewardAuditEntry, StewardPlan, StewardResponse, StewardScope } from "../steward/models";
import { previewPlan } from "../steward/operationPreview";

interface StewardDrawerProps {
  isOpen: boolean;
  collection: InventoryCollection | null;
  collections: InventoryCollection[];
  cards: InventoryCard[];
  filteredCards: InventoryCard[];
  selectedCardIds: string[];
  filters: InventoryFilters;
  auditEntries: StewardAuditEntry[];
  onClose: () => void;
  onApply: (plan: StewardPlan) => Promise<void>;
  onUndo: () => Promise<void>;
  onExportCollection: (collectionId: string) => Promise<void>;
}

const suggestions: Array<{ title: string; request: string; description: string }> = [
  {
    title: "Split by set and rarity",
    request: "Break this collection down by set name and rarity",
    description: "Create smaller Cardmarket-friendly collections.",
  },
  {
    title: "Create batches of 75",
    request: "Create Cardmarket batches of 75 by set and rarity",
    description: "Keep every generated collection under the bulk upload size.",
  },
  {
    title: "Separate foils",
    request: "Separate foil cards into smaller collections",
    description: "Pull foil finishes into their own reviewable groups.",
  },
  {
    title: "Show invalid records",
    request: "Show invalid records",
    description: "Focus the table on rows that need manual cleanup.",
  },
];

export function StewardDrawer({
  isOpen,
  collection,
  collections,
  cards,
  filteredCards,
  selectedCardIds,
  filters,
  auditEntries,
  onClose,
  onApply,
  onUndo,
  onExportCollection,
}: StewardDrawerProps) {
  const [request, setRequest] = useState("");
  const [scope, setScope] = useState<StewardScope>("all");
  const [response, setResponse] = useState<StewardResponse | null>(null);
  const [preview, setPreview] = useState<OperationPreview[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const summary = useMemo(() => {
    if (!collection) return null;
    return buildCollectionSummaryContext({ collection, cards, selectedCardIds, filters });
  }, [cards, collection, filters, selectedCardIds]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!collection || !summary) return;
    setIsLoading(true);
    setError("");
    setResponse(null);
    setPreview([]);

    try {
      const nextResponse = await requestStewardPlan({ request, scope, context: summary });
      setResponse(nextResponse);
      if (nextResponse.type === "plan") {
        const localPreview = previewPlan(nextResponse.plan, {
          collection,
          cards,
          filteredCards,
          selectedCardIds,
          filters,
          existingCollections: collections,
        });
        setPreview(localPreview.previews);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSV Steward could not create a plan.");
    } finally {
      setIsLoading(false);
    }
  };

  const apply = async () => {
    if (response?.type !== "plan") return;
    const destructive = preview.some((item) => item.destructive);
    const totalCreated = preview.reduce((total, item) => total + item.plannedCollections.length, 0);
    if (destructive && !window.confirm("This plan is destructive. Apply it anyway?")) return;
    if (totalCreated > 20 && !window.confirm(`This will create ${totalCreated} collections. Continue?`)) return;

    setIsApplying(true);
    try {
      await onApply(response.plan);
      setResponse(null);
      setPreview([]);
      setRequest("");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <aside className="steward-drawer" aria-label="CSV Steward">
      <div className="panel-header">
        <div>
          <p className="eyebrow">CSV Steward</p>
          <h2>{collection?.name ?? "No collection"}</h2>
          <span>{cards.length} record(s)</span>
        </div>
        <button className="icon-button" type="button" title="Close Steward" aria-label="Close Steward" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <p className="privacy-note">
        Your request and a compact collection summary are sent to Anthropic. Full card records are not sent by default. Changes apply locally only after approval.
      </p>

      <label className="select-field">
        <span>Scope</span>
        <select value={scope} onChange={(event) => setScope(event.target.value as StewardScope)}>
          <option value="all">Entire collection</option>
          <option value="filtered">Current filtered records</option>
          <option value="selected">Selected records</option>
        </select>
      </label>

      <section className="steward-card">
        <div className="steward-card-title">
          <Sparkles size={18} />
          <h3>Common operations</h3>
        </div>
        <ul className="operation-list">
          {suggestions.map((suggestion) => (
            <li key={suggestion.title}>
              <button
                type="button"
                onClick={() => setRequest(suggestion.request)}
              >
                <strong>{suggestion.title}</strong>
                <span>{suggestion.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <label className="field steward-request">
        <span>Custom request</span>
        <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={5} placeholder="Break this collection down by set name and rarity" />
      </label>

      <button className="button primary" type="button" disabled={!request.trim() || isLoading || !collection} onClick={() => void submit()}>
        <Sparkles size={18} />
        {isLoading ? "Planning" : "Plan operation"}
      </button>

      {error ? <p className="notice error-text">{error}</p> : null}
      {response?.type === "clarification" ? (
        <section className="steward-card">
          <h3>Clarification needed</h3>
          <p>{response.question}</p>
          {response.options?.map((option) => <span className="badge finish" key={option}>{option}</span>)}
        </section>
      ) : null}
      {response?.type === "unsupported" ? (
        <section className="steward-card">
          <h3>Unsupported</h3>
          <p>{response.message}</p>
        </section>
      ) : null}
      {response?.type === "plan" ? (
        <section className="steward-card">
          <div className="steward-card-title">
            <Bot size={18} />
            <h3>{response.plan.title}</h3>
          </div>
          <p>{response.plan.summary}</p>
          {response.plan.assumptions.length > 0 ? <p>Assumptions: {response.plan.assumptions.join("; ")}</p> : null}
          {response.plan.warnings.map((warning) => (
            <p className="warning-text" key={warning.code}>{warning.message}</p>
          ))}
          <PreviewList previews={preview} />
          <div className="panel-actions">
            <button className="button primary" type="button" disabled={isApplying} onClick={() => void apply()}>
              <CheckCircle2 size={18} />
              {isApplying ? "Applying" : "Apply plan"}
            </button>
            <button className="button ghost" type="button" onClick={() => { setResponse(null); setPreview([]); }}>
              Reject
            </button>
          </div>
        </section>
      ) : null}

      <section className="steward-card">
        <div className="steward-card-title">
          <History size={18} />
          <h3>Recent actions</h3>
        </div>
        {auditEntries.length === 0 ? <p>No Steward actions yet.</p> : null}
        {auditEntries.slice(0, 5).map((entry) => (
          <div className="audit-entry" key={entry.id}>
            <div className="audit-row">
              <span>{entry.plan.title}</span>
              <strong>{entry.status}</strong>
            </div>
            {entry.changeSet.createdCollections.length > 0 ? (
              <div className="audit-downloads">
                <strong>Download created collections</strong>
                {entry.changeSet.createdCollections.map((createdCollection) => (
                  <button
                    className="button ghost"
                    type="button"
                    key={createdCollection.id}
                    disabled={entry.status !== "applied"}
                    onClick={() => void onExportCollection(createdCollection.id)}
                  >
                    <Download size={16} />
                    {createdCollection.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <button className="button secondary" type="button" disabled={!auditEntries.some((entry) => entry.status === "applied")} onClick={() => void onUndo()}>
          <Undo2 size={18} />
          Undo latest
        </button>
      </section>
    </aside>
  );
}

function PreviewList({ previews }: { previews: OperationPreview[] }) {
  return (
    <div className="preview-list">
      {previews.map((item) => (
        <div className="preview-item" key={item.operationId}>
          <strong>{item.operationType}</strong>
          <span>{item.matchedRecordCount} matched, {item.changedRecordCount} changed</span>
          {item.plannedCollections.length > 0 ? (
            <div className="planned-collections">
              <strong>Collections to create</strong>
              {item.plannedCollections.slice(0, 12).map((collection) => (
                <div className="planned-collection" key={collection.id}>
                  <span>{collection.name}</span>
                  <small>{collection.recordCount} rows, qty {collection.totalQuantity}</small>
                </div>
              ))}
              {item.plannedCollections.length > 12 ? <small>+ {item.plannedCollections.length - 12} more</small> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
