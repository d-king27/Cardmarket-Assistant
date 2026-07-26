import { describe, expect, it } from 'vitest';

import {
  ListingBatchMessageSchema,
  PROTOCOL_VERSION,
} from './contracts';

describe('Playwright bridge contracts', () => {
  it('validates a supported batch before extension processing', () => {
    const result = ListingBatchMessageSchema.safeParse({
      protocolVersion: PROTOCOL_VERSION,
      type: 'listing-batch',
      batchId: 'batch-1',
      createdAt: '2026-07-26T12:00:00.000Z',
      records: [{ id: 'card-1', name: 'Lightning Bolt', quantity: 1 }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects unversioned messages', () => {
    const result = ListingBatchMessageSchema.safeParse({
      type: 'listing-batch',
      batchId: 'batch-1',
      createdAt: '2026-07-26T12:00:00.000Z',
      records: [{ id: 'card-1', name: 'Lightning Bolt', quantity: 1 }],
    });

    expect(result.success).toBe(false);
  });
});
