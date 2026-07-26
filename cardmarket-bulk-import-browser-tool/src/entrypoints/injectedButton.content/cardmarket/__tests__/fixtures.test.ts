import { describe, expect, it } from 'vitest';

import replacementTable from '../__fixtures__/bulk-listing-table-replacement.html?raw';
import bulkListingTable from '../__fixtures__/bulk-listing-table.html?raw';

describe('Cardmarket DOM fixtures', () => {
  it('contains representative product links and form controls', () => {
    document.body.innerHTML = bulkListingTable;

    expect(document.querySelectorAll('td div.col-product.text-start a')).toHaveLength(2);
    expect(document.querySelector('input[name^="amount"]')).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelector('input[name^="price"]')).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelector('select[name^="idLanguage"]')).toBeInstanceOf(HTMLSelectElement);
    expect(document.querySelector('input[name^="isFoil"]')).toBeInstanceOf(HTMLInputElement);
  });

  it('represents a replaced page table with a different visible product', () => {
    document.body.innerHTML = replacementTable;

    const productLink = document.querySelector('td div.col-product.text-start a');

    expect(productLink).toBeInstanceOf(HTMLAnchorElement);
    expect(productLink?.textContent?.trim()).toBe('Opt');
  });
});
