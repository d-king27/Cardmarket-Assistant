import {
  AlertTriangle,
  CheckCircle2,
  FolderOutput,
  PackageOpen,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildQueuePublishRequest,
  DEFAULT_MAXIMUM_ROWS,
} from "../cardmarket/queueModels";
import type {
  QueueJobManifest,
  QueueScope,
  QueueSettings,
} from "../cardmarket/queueModels";
import { planCardmarketQueue } from "../cardmarket/queuePlanner";
import type { InventoryCard, InventoryCollection } from "../models/inventory";
import {
  listCardmarketQueues,
  publishCardmarketQueue,
} from "../services/cardmarketQueueApi";
import type { PublishedQueueJob } from "../services/cardmarketQueueApi";

interface CardmarketQueueDrawerProps {
  isOpen: boolean;
  collection: InventoryCollection | null;
  cards: InventoryCard[];
  filteredCards: InventoryCard[];
  selectedCardIds: string[];
  onClose: () => void;
}

export function CardmarketQueueDrawer({
  isOpen,
  collection,
  cards,
  filteredCards,
  selectedCardIds,
  onClose,
}: CardmarketQueueDrawerProps) {
  const [scope, setScope] = useState<QueueScope>("all");
  const [maximumRows, setMaximumRows] = useState(DEFAULT_MAXIMUM_ROWS);
  const [excludeBlockedRows, setExcludeBlockedRows] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedQueueJob | null>(null);
  const [jobs, setJobs] = useState<QueueJobManifest[]>([]);

  const scopedCards = useMemo(() => {
    if (scope === "filtered") return filteredCards;
    if (scope === "selected") {
      const selected = new Set(selectedCardIds);
      return cards.filter((card) => selected.has(card.id));
    }
    return cards;
  }, [cards, filteredCards, scope, selectedCardIds]);

  const settings: QueueSettings = useMemo(
    () => ({
      scope,
      maximumRows,
      priceSource: "targetPrice",
      excludeBlockedRows,
    }),
    [excludeBlockedRows, maximumRows, scope],
  );

  const request = useMemo(() => {
    if (!collection || scopedCards.length === 0) return null;
    return buildQueuePublishRequest({ collection, cards: scopedCards, settings });
  }, [collection, scopedCards, settings]);

  const plan = useMemo(() => (request ? planCardmarketQueue(request) : null), [request]);

  const refreshJobs = async () => {
    setIsLoadingJobs(true);
    try {
      setJobs(await listCardmarketQueues());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Cardmarket queue jobs.");
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    void refreshJobs();
  }, [isOpen]);

  if (!isOpen) return null;

  const publish = async () => {
    if (!request || !plan) return;
    setIsPublishing(true);
    setError("");
    setPublished(null);
    try {
      const result = await publishCardmarketQueue(request);
      setPublished(result);
      setJobs((current) => [result.job, ...current.filter((job) => job.jobId !== result.job.jobId)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish the Cardmarket queue.");
    } finally {
      setIsPublishing(false);
    }
  };

  const blockedWithoutExclusion =
    (plan?.preview.blockedRecordCount ?? 0) > 0 && !excludeBlockedRows;
  const canPublish =
    Boolean(request) &&
    (plan?.preview.readyRecordCount ?? 0) > 0 &&
    !blockedWithoutExclusion &&
    !isPublishing;

  return (
    <aside className="steward-drawer queue-drawer" aria-label="Prepare Cardmarket queue">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Deterministic workflow</p>
          <h2>Prepare Cardmarket queue</h2>
          <span>{collection?.name ?? "No collection"}</span>
        </div>
        <button className="icon-button" type="button" title="Close queue" aria-label="Close queue" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <p className="privacy-note">
        Queue preparation is local and does not use AI. Your source collection is never modified.
      </p>

      <section className="steward-card">
        <div className="steward-card-title">
          <PackageOpen size={18} />
          <h3>Preparation settings</h3>
        </div>
        <label className="select-field">
          <span>Scope</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as QueueScope)}>
            <option value="all">Entire collection</option>
            <option value="filtered">Current filtered records</option>
            <option value="selected">Selected records</option>
          </select>
        </label>
        <label className="field">
          <span>Maximum rows per CSV</span>
          <input
            type="number"
            min="1"
            max="100"
            value={maximumRows}
            onChange={(event) => {
              const value = Number(event.target.value);
              setMaximumRows(Number.isInteger(value) ? Math.min(100, Math.max(1, value)) : DEFAULT_MAXIMUM_ROWS);
            }}
          />
        </label>
        <label className="field">
          <span>Listing price source</span>
          <input value="Target price" disabled />
        </label>
        {(plan?.preview.blockedRecordCount ?? 0) > 0 ? (
          <label className="queue-checkbox">
            <input
              type="checkbox"
              checked={excludeBlockedRows}
              onChange={(event) => setExcludeBlockedRows(event.target.checked)}
            />
            <span>Explicitly exclude blocked rows from this queue job</span>
          </label>
        ) : null}
      </section>

      {plan ? (
        <>
          <section className="queue-summary" aria-label="Queue summary">
            <Summary label="Source" value={plan.preview.sourceRecordCount} />
            <Summary label="Ready" value={plan.preview.readyRecordCount} />
            <Summary label="Blocked" value={plan.preview.blockedRecordCount} tone="error" />
            <Summary label="Batches" value={plan.preview.batches.length} />
          </section>

          {plan.preview.blockers.length > 0 ? (
            <IssueSection
              title="Blocking issues"
              issues={plan.preview.blockers}
              icon={<AlertTriangle size={18} />}
              className="queue-issues error"
            />
          ) : (
            <section className="steward-card queue-ready">
              <div className="steward-card-title">
                <CheckCircle2 size={18} />
                <h3>Ready to publish</h3>
              </div>
              <p>Every selected record passed deterministic queue validation.</p>
            </section>
          )}

          {plan.preview.warnings.length > 0 ? (
            <IssueSection
              title="Warnings"
              issues={plan.preview.warnings}
              icon={<AlertTriangle size={18} />}
              className="queue-issues warning"
            />
          ) : null}

          <section className="steward-card">
            <h3>Proposed CSV files</h3>
            {plan.preview.batches.length === 0 ? <p>No CSV files can be produced from this scope.</p> : null}
            <div className="queue-batch-list">
              {plan.preview.batches.map((batch) => (
                <div className="planned-collection" key={batch.batchId}>
                  <span>{batch.filename}</span>
                  <small>{batch.rowCount} rows · qty {batch.totalQuantity}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="notice">The selected scope contains no records.</p>
      )}

      <button className="button primary" type="button" disabled={!canPublish} onClick={() => void publish()}>
        <FolderOutput size={18} />
        {isPublishing ? "Publishing queue" : "Publish queue job"}
      </button>
      {blockedWithoutExclusion ? (
        <p className="notice error-text">Correct the blocked rows or explicitly exclude them before publishing.</p>
      ) : null}
      {error ? <p className="notice error-text">{error}</p> : null}
      {published ? (
        <section className="steward-card queue-published">
          <div className="steward-card-title">
            <CheckCircle2 size={18} />
            <h3>Queue published</h3>
          </div>
          <p>{published.job.summary.batchCount} CSV file(s) are ready.</p>
          <code>{published.directory}</code>
        </section>
      ) : null}

      <section className="steward-card">
        <div className="queue-jobs-header">
          <div className="steward-card-title">
            <FolderOutput size={18} />
            <h3>Local queue jobs</h3>
          </div>
          <button className="icon-button" type="button" title="Refresh jobs" aria-label="Refresh jobs" disabled={isLoadingJobs} onClick={() => void refreshJobs()}>
            <RefreshCw size={16} />
          </button>
        </div>
        {jobs.length === 0 ? <p>{isLoadingJobs ? "Loading jobs…" : "No queue jobs have been published yet."}</p> : null}
        <div className="queue-job-list">
          {jobs.map((job) => (
            <div className="audit-entry" key={job.jobId}>
              <div className="audit-row">
                <span>{job.collection.name}</span>
                <strong>{job.status}</strong>
              </div>
              <small>{job.summary.batchCount} batches · {job.summary.queuedRecordCount} records</small>
              <code>{job.jobId}</code>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "error";
}) {
  return (
    <div className={`queue-summary-item${tone ? ` ${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IssueSection({
  title,
  issues,
  icon,
  className,
}: {
  title: string;
  issues: Array<{ cardId: string; code: string; cardName: string; sourceRow: number; message: string }>;
  icon: React.ReactNode;
  className: string;
}) {
  return (
    <section className={`steward-card ${className}`}>
      <div className="steward-card-title">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="queue-issue-list">
        {issues.slice(0, 20).map((issue) => (
          <div className="queue-issue" key={`${issue.cardId}-${issue.code}-${issue.message}`}>
            <strong>{issue.cardName}</strong>
            <span>Row {issue.sourceRow}: {issue.message}</span>
          </div>
        ))}
        {issues.length > 20 ? <small>+ {issues.length - 20} additional issue(s)</small> : null}
      </div>
    </section>
  );
}
