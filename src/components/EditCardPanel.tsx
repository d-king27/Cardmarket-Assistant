import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { InventoryCard } from "../models/inventory";
import { validateEditableDraft } from "../services/inventoryValidator";

interface EditCardPanelProps {
  card: InventoryCard | null;
  onSave: (cardId: string, updates: Partial<InventoryCard>) => Promise<void>;
  onClose: () => void;
}

type Draft = Pick<
  InventoryCard,
  | "quantity"
  | "condition"
  | "language"
  | "purchasePrice"
  | "purchasePriceCurrency"
  | "targetPrice"
  | "notes"
>;

export function EditCardPanel({ card, onSave, onClose }: EditCardPanelProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof InventoryCard, string>>>({});
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!card) {
      setDraft(null);
      return;
    }

    setDraft({
      quantity: card.quantity,
      condition: card.condition,
      language: card.language,
      purchasePrice: card.purchasePrice,
      purchasePriceCurrency: card.purchasePriceCurrency,
      targetPrice: card.targetPrice,
      notes: card.notes,
    });
    setErrors({});
    setSavedMessage("");
  }, [card]);

  if (!card || !draft) {
    return null;
  }

  const setText = (field: keyof Draft, value: string) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const setNumber = (field: "quantity" | "purchasePrice" | "targetPrice", value: string) => {
    const parsed = value.trim() === "" ? (field === "quantity" ? Number.NaN : null) : Number(value);
    setDraft((current) => (current ? { ...current, [field]: parsed } : current));
  };

  const save = async () => {
    const nextErrors = validateEditableDraft(draft);
    setErrors(nextErrors);
    setSavedMessage("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSave(card.id, {
      ...draft,
      purchasePriceCurrency:
        draft.purchasePriceCurrency?.trim() === ""
          ? null
          : draft.purchasePriceCurrency?.trim().toUpperCase() ?? null,
      condition: draft.condition.trim(),
      language: draft.language.trim(),
      notes: draft.notes.trim(),
    });
    setSavedMessage("Saved");
  };

  return (
    <aside className="edit-panel" aria-label="Edit card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Edit record</p>
          <h2>{card.name}</h2>
          <span>
            {card.setCode} #{card.collectorNumber}
          </span>
        </div>
        <button className="icon-button" type="button" title="Close editor" aria-label="Close editor" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="form-grid">
        <NumberField label="Quantity" value={draft.quantity} error={errors.quantity} onChange={(value) => setNumber("quantity", value)} />
        <TextField label="Condition" value={draft.condition} error={errors.condition} onChange={(value) => setText("condition", value)} />
        <TextField label="Language" value={draft.language} error={errors.language} onChange={(value) => setText("language", value)} />
        <NumberField label="Purchase price" value={draft.purchasePrice} error={errors.purchasePrice} onChange={(value) => setNumber("purchasePrice", value)} />
        <TextField label="Currency" value={draft.purchasePriceCurrency ?? ""} error={errors.purchasePriceCurrency} onChange={(value) => setText("purchasePriceCurrency", value)} />
        <NumberField label="Target price" value={draft.targetPrice} error={errors.targetPrice} onChange={(value) => setNumber("targetPrice", value)} />
        <label className="field full-span">
          <span>Notes</span>
          <textarea value={draft.notes} onChange={(event) => setText("notes", event.target.value)} rows={5} />
        </label>
      </div>
      <div className="panel-actions">
        <button className="button primary" type="button" onClick={save}>
          <Save size={18} />
          Save
        </button>
        {savedMessage ? <strong className="saved-message">{savedMessage}</strong> : null}
      </div>
    </aside>
  );
}

function TextField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <small>{error}</small> : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: number | null;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={label === "Quantity" ? "1" : "0.01"}
        value={value === null || Number.isNaN(value) ? "" : value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <small>{error}</small> : null}
    </label>
  );
}
