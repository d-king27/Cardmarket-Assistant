import { describe, expect, it } from 'vitest';

import { parseCardmarketPageContext, parseExpansionId } from '../pageContext';

describe('parseExpansionId', () => {
  it('treats a present numeric expansion ID as valid', () => {
    expect(parseExpansionId(new URLSearchParams('idExpansion=123'))).toEqual({
      kind: 'valid',
      value: 123,
      rawValue: '123',
    });
  });

  it('treats a missing expansion ID as absent, not zero', () => {
    expect(parseExpansionId(new URLSearchParams(''))).toEqual({
      kind: 'absent',
      value: null,
      rawValue: null,
    });
  });

  it('treats malformed expansion IDs as malformed', () => {
    expect(parseExpansionId(new URLSearchParams('idExpansion=abc'))).toEqual({
      kind: 'malformed',
      value: null,
      rawValue: 'abc',
    });
  });
});

describe('parseCardmarketPageContext', () => {
  it('parses Cardmarket bulk listing context from a URL', () => {
    const context = parseCardmarketPageContext(
      'https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing?idExpansion=456&page=2&sort=name',
    );

    expect(context).toMatchObject({
      game: 'Magic',
      pageNumber: 2,
      sortOrder: 'name',
      isBulkListingPage: true,
      canValidateExpansion: true,
    });
    expect(context.expansionId).toMatchObject({ kind: 'valid', value: 456 });
  });

  it('keeps expansion validation unavailable when the ID is absent', () => {
    const context = parseCardmarketPageContext(
      'https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing',
    );

    expect(context.expansionId.kind).toBe('absent');
    expect(context.canValidateExpansion).toBe(false);
  });
});
