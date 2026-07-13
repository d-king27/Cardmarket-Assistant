import { Search, X } from "lucide-react";
import type { InventoryCard, InventoryFilters as InventoryFiltersModel } from "../models/inventory";
import { emptyFilters } from "../models/inventory";

interface InventoryFiltersProps {
  cards: InventoryCard[];
  filters: InventoryFiltersModel;
  search: string;
  onFiltersChange: (filters: InventoryFiltersModel) => void;
  onSearchChange: (search: string) => void;
}

export function InventoryFilters({
  cards,
  filters,
  search,
  onFiltersChange,
  onSearchChange,
}: InventoryFiltersProps) {
  const options = {
    setCode: unique(cards.map((card) => card.setCode)),
    rarity: unique(cards.map((card) => card.rarity)),
    condition: unique(cards.map((card) => card.condition)),
    language: unique(cards.map((card) => card.language)),
    finish: unique(cards.map((card) => card.finish)),
  };

  const update = (key: keyof InventoryFiltersModel, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="filters-panel" aria-label="Inventory filters">
      <label className="search-field">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name, set, collector number"
        />
      </label>
      <FilterSelect label="Set" value={filters.setCode} options={options.setCode} onChange={(value) => update("setCode", value)} />
      <FilterSelect label="Rarity" value={filters.rarity} options={options.rarity} onChange={(value) => update("rarity", value)} />
      <FilterSelect label="Condition" value={filters.condition} options={options.condition} onChange={(value) => update("condition", value)} />
      <FilterSelect label="Language" value={filters.language} options={options.language} onChange={(value) => update("language", value)} />
      <FilterSelect label="Finish" value={filters.finish} options={options.finish} onChange={(value) => update("finish", value)} />
      <label className="select-field">
        <span>Status</span>
        <select
          value={filters.validationStatus}
          onChange={(event) => update("validationStatus", event.target.value)}
        >
          <option value="">All</option>
          <option value="valid">Valid</option>
          <option value="warning">Warnings</option>
          <option value="error">Errors</option>
          <option value="duplicate">Duplicates</option>
        </select>
      </label>
      <button
        className="icon-button"
        type="button"
        title="Clear filters"
        aria-label="Clear filters"
        onClick={() => {
          onFiltersChange(emptyFilters);
          onSearchChange("");
        }}
      >
        <X size={18} />
      </button>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
