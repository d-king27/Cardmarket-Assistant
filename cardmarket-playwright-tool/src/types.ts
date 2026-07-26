import type {
  ListingBatchMessage,
  ListingBatchResultMessage,
  ListingRecord,
} from "@cardmarket-assistant/contracts";

export {
  CardmarketPageContextSchema,
  FillResultSchema,
  LISTING_PROTOCOL_VERSION,
  ListingBatchMessageSchema,
  ListingBatchResultMessageSchema,
  ListingRecordSchema,
  PROTOCOL_VERSION,
} from "@cardmarket-assistant/contracts";
export type {
  CardmarketPageContext,
  FillResult,
  ListingBatchMessage,
  ListingBatchResultMessage,
  ListingRecord,
} from "@cardmarket-assistant/contracts";

export interface SetBatch {
  setCode?: string;
  setName?: string;
  records: ListingRecord[];
}

export interface ImportPreviewDiagnostics {
  state: "preview-ready" | "no-current-page-matches";
  selectedCount: number;
  eligibleCount: number;
  parsedCount: number;
  fillPageAvailable: boolean;
}

export interface DryRunReport {
  reportVersion: 1;
  reportType: "playwright-companion-dry-run";
  generatedAt: string;
  input: {
    batchFile: string;
    recordCount: number;
  };
  bridge: {
    adapter: string;
    mocked: boolean;
  };
  set: {
    code?: string;
    name?: string;
    stagedRecordCount: number;
  };
  importPreview: ImportPreviewDiagnostics;
  result: ListingBatchResultMessage;
}
