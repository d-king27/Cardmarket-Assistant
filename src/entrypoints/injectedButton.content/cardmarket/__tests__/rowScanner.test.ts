import { describe, expect, it } from 'vitest';

import replacementTable from '../__fixtures__/bulk-listing-table-replacement.html?raw';
import bulkListingTable from '../__fixtures__/bulk-listing-table.html?raw';
import { extractCardmarketProductId, scanCardmarketPageRows } from '../rowScanner';

describe('scanCardmarketPageRows', () => {
  it('returns typed descriptors for visible Cardmarket rows', () => {
    document.body.innerHTML = bulkListingTable;

    const rows = scanCardmarketPageRows();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: 'product:12345',
      displayedName: 'Lightning Bolt',
      productId: 12345,
    });
    expect(rows[0]?.rowElement).toBeInstanceOf(HTMLTableRowElement);
    expect(rows[0]?.productLinkElement).toBeInstanceOf(HTMLAnchorElement);
    expect(rows[0]?.quantityInput).toBeInstanceOf(HTMLInputElement);
    expect(rows[0]?.priceInput).toBeInstanceOf(HTMLInputElement);
    expect(rows[0]?.languageSelect).toBeInstanceOf(HTMLSelectElement);
    expect(rows[0]?.foilInput).toBeInstanceOf(HTMLInputElement);
  });

  it('reflects the current DOM after the table is replaced', () => {
    document.body.innerHTML = bulkListingTable;
    expect(scanCardmarketPageRows().map((row) => row.displayedName)).toEqual([
      'Lightning Bolt',
      'Counterspell',
    ]);

    document.body.innerHTML = replacementTable;

    expect(scanCardmarketPageRows().map((row) => row.displayedName)).toEqual(['Opt']);
  });
});

describe('extractCardmarketProductId', () => {
  it('extracts numeric product IDs from Cardmarket URLs', () => {
    expect(extractCardmarketProductId('/en/Magic/Products/Singles/Example?idProduct=24680')).toBe(24680);
  });

  it('returns null for missing or malformed product IDs', () => {
    expect(extractCardmarketProductId('/en/Magic/Products/Singles/Example')).toBeNull();
    expect(extractCardmarketProductId('/en/Magic/Products/Singles/Example?idProduct=abc')).toBeNull();
  });
});
