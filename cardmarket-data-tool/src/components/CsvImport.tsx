import { CheckCircle2, FileSpreadsheet, FileUp, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { InventoryCard } from "../models/inventory";
import { parseManaBoxCsv } from "../services/csvParser";

interface CsvImportProps {
  onImport: (cards: InventoryCard[], filename: string) => Promise<void>;
}

export function CsvImport({ onImport }: CsvImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const chooseFile = (file: File | null) => {
    setMessage(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setSelectedFile(null);
      setMessage("Choose a CSV file exported from ManaBox.");
      return;
    }

    setSelectedFile(file);
  };

  const importSelected = async () => {
    if (!selectedFile) {
      setMessage("Choose a CSV file before importing.");
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const text = await readFileText(selectedFile);
      const result = parseManaBoxCsv(text);
      const importWarnings = [
        ...result.rowIssues.map((issue) => issue.message),
        ...result.missingRequiredHeaders.map((header) => `Missing required header: ${header}`),
        ...result.unknownHeaders.map((header) => `Unknown column preserved: ${header}`),
      ];

      await onImport(result.cards, selectedFile.name);
      setMessage(
        importWarnings.length > 0
          ? `Imported with ${importWarnings.length} warning(s). ${importWarnings[0]}`
          : `Imported ${result.cards.length} record(s).`,
      );
    } catch (caught) {
      console.error("Import failed", caught);
      setMessage("The file could not be read or imported.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section
      className="import-panel"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        chooseFile(event.dataTransfer.files.item(0));
      }}
    >
      <div className="import-copy">
        <p className="eyebrow">Local CSV inventory</p>
        <h1>ManaBox CSV Manager</h1>
        <p>
          Import a ManaBox export to create a new local collection for review and editing.
        </p>
      </div>
      <div className={selectedFile ? "csv-dropzone ready" : "csv-dropzone"}>
        <div className="csv-dropzone-icon">
          {selectedFile ? <CheckCircle2 size={28} /> : <FileSpreadsheet size={28} />}
        </div>
        <div className="csv-dropzone-main">
          <span className={selectedFile ? "file-pill ready" : "file-pill"}>
            {selectedFile ? (
              <>
                <CheckCircle2 size={16} />
                CSV ready
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                Waiting for CSV
              </>
            )}
          </span>
          <strong>{selectedFile ? selectedFile.name : "Drop a ManaBox CSV here"}</strong>
          <span>
            {selectedFile
              ? "Everything is set. Import will create a new collection from this file."
              : "Choose or drag in a .csv file exported from ManaBox."}
          </span>
        </div>
        <div className="import-controls">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            aria-label="CSV file"
            accept=".csv,text/csv"
            onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)}
          />
          <button
            className="button secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Choose CSV file"
            title="Choose CSV file"
          >
            <FileUp size={18} />
            Choose CSV
          </button>
          <button
            className="button primary import-button"
            type="button"
            onClick={importSelected}
            disabled={isImporting}
          >
            <Upload size={18} />
            {isImporting ? "Importing" : "Import CSV"}
          </button>
        </div>
      </div>
      <div className="import-status">
        <span>Each import is saved as a separate collection.</span>
      </div>
      {message ? <p className="notice">{message}</p> : null}
    </section>
  );
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsText(file);
  });
}
