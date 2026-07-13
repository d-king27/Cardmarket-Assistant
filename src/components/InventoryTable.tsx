import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { BadgeCheck, Edit, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { InventoryCard } from "../models/inventory";

interface InventoryTableProps {
  cards: InventoryCard[];
  selectedRows: RowSelectionState;
  onSelectedRowsChange: (rows: RowSelectionState) => void;
  onEdit: (card: InventoryCard) => void;
  onRemoveSelected: (ids: string[]) => void;
}

export function InventoryTable({
  cards,
  selectedRows,
  onSelectedRowsChange,
  onEdit,
  onRemoveSelected,
}: InventoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<InventoryCard>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all visible records"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
      },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "setCode", header: "Set" },
      { accessorKey: "setName", header: "Set name" },
      { accessorKey: "collectorNumber", header: "No." },
      {
        accessorKey: "finish",
        header: "Finish",
        cell: ({ getValue }) => <span className="badge finish">{String(getValue() || "none")}</span>,
      },
      {
        accessorKey: "rarity",
        header: "Rarity",
        cell: ({ getValue }) => <span className="badge rarity">{String(getValue() || "unknown")}</span>,
      },
      { accessorKey: "quantity", header: "Qty" },
      {
        accessorKey: "condition",
        header: "Condition",
        cell: ({ getValue }) => (
          <span className="badge condition">
            <BadgeCheck size={14} />
            {String(getValue() || "unknown")}
          </span>
        ),
      },
      { accessorKey: "language", header: "Lang" },
      {
        accessorKey: "purchasePrice",
        header: "Price",
        cell: ({ row }) =>
          row.original.purchasePrice === null
            ? ""
            : `${row.original.purchasePriceCurrency ?? ""} ${row.original.purchasePrice}`.trim(),
      },
      { accessorKey: "purchasePriceCurrency", header: "Currency" },
      {
        accessorKey: "targetPrice",
        header: "Target",
        cell: ({ row }) => (row.original.targetPrice === null ? "" : row.original.targetPrice),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <ValidationBadge card={row.original} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            className="icon-button"
            type="button"
            title="Edit record"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => onEdit(row.original)}
          >
            <Edit size={16} />
          </button>
        ),
        enableSorting: false,
      },
    ],
    [onEdit],
  );

  const table = useReactTable({
    data: cards,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, rowSelection: selectedRows },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      onSelectedRowsChange(typeof updater === "function" ? updater(selectedRows) : updater);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

  if (cards.length === 0) {
    return (
      <section className="empty-state">
        <h2>No matching records</h2>
        <p>Adjust the filters or import a ManaBox CSV.</p>
      </section>
    );
  }

  return (
    <section className="table-panel">
      <div className="table-toolbar">
        <span>
          Showing {table.getRowModel().rows.length} of {cards.length} filtered record(s)
        </span>
        <button
          className="button danger"
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => onRemoveSelected(selectedIds)}
        >
          <Trash2 size={18} />
          Remove selected
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        className="table-heading"
                        type="button"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                        {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button className="button ghost" type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button className="button ghost" type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </button>
      </div>
    </section>
  );
}

function ValidationBadge({ card }: { card: InventoryCard }) {
  const hasError = card.validationIssues.some((issue) => issue.severity === "error");
  const hasWarning = card.validationIssues.some((issue) => issue.severity === "warning");
  const label = hasError ? "Error" : hasWarning ? "Warning" : "Valid";
  const className = hasError ? "error" : hasWarning ? "warning" : "valid";

  return (
    <span className={`badge ${className}`} title={card.validationIssues.map((issue) => issue.message).join(" ")}>
      {label}
    </span>
  );
}
