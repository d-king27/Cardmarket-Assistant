import { cardmarketSelectors } from './selectors';

export interface CardmarketPageRow {
  key: string,
  rowElement: HTMLTableRowElement,
  productLinkElement: HTMLAnchorElement,
  displayedName: string,
  productUrl: string | null,
  productId: number | null,
  quantityInput: HTMLInputElement | null,
  priceInput: HTMLInputElement | null,
  languageSelect: HTMLSelectElement | null,
  foilInput: HTMLInputElement | null,
}

type ScanRoot = Document | Element;

function toAbsoluteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value, window.location.href).toString();
  }
  catch {
    return value;
  }
}

export function extractCardmarketProductId(productUrl: string | null): number | null {
  if (!productUrl) return null;
  try {
    const parsedUrl = new URL(productUrl, window.location.href);
    const idProduct = parsedUrl.searchParams.get('idProduct');
    if (!idProduct || !/^\d+$/.test(idProduct)) return null;
    return Number(idProduct);
  }
  catch {
    return null;
  }
}

function createRowKey(index: number, displayedName: string, productUrl: string | null, productId: number | null) {
  if (productId !== null) return `product:${productId}`;
  return `row:${index}:${displayedName}:${productUrl ?? ''}`;
}

export function scanCardmarketPageRows(root: ScanRoot = document): CardmarketPageRow[] {
  const productLinks = root.querySelectorAll<HTMLAnchorElement>(cardmarketSelectors.productLink);

  return [...productLinks].flatMap((productLinkElement, index) => {
    const rowElement = productLinkElement.closest('tr');
    if (!(rowElement instanceof HTMLTableRowElement)) return [];

    const displayedName = productLinkElement.textContent?.trim() ?? '';
    const productUrl = toAbsoluteUrl(productLinkElement.getAttribute('href'));
    const productId = extractCardmarketProductId(productUrl);

    return [{
      key: createRowKey(index, displayedName, productUrl, productId),
      rowElement,
      productLinkElement,
      displayedName,
      productUrl,
      productId,
      quantityInput: rowElement.querySelector<HTMLInputElement>(cardmarketSelectors.quantityInput),
      priceInput: rowElement.querySelector<HTMLInputElement>(cardmarketSelectors.priceInput),
      languageSelect: rowElement.querySelector<HTMLSelectElement>(cardmarketSelectors.languageInput),
      foilInput: rowElement.querySelector<HTMLInputElement>(cardmarketSelectors.foilInput),
    }];
  });
}
