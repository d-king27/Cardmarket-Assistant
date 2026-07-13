export type ExpansionIdState
  = | { kind: 'valid', value: number, rawValue: string }
    | { kind: 'absent', value: null, rawValue: null }
    | { kind: 'malformed', value: null, rawValue: string };

export interface CardmarketPageContext {
  url: string,
  pathname: string,
  game: string | null,
  expansionId: ExpansionIdState,
  expansionName: string | null,
  rarity: string | null,
  pageNumber: number | null,
  sortOrder: string | null,
  isBulkListingPage: boolean,
  canValidateExpansion: boolean,
}

function parsePositiveIntegerParam(searchParams: URLSearchParams, key: string): number | null {
  const rawValue = searchParams.get(key);
  if (!rawValue || !/^\d+$/.test(rawValue)) return null;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

export function parseExpansionId(searchParams: URLSearchParams): ExpansionIdState {
  const rawValue = searchParams.get('idExpansion');
  if (rawValue === null) return { kind: 'absent', value: null, rawValue: null };
  if (!/^\d+$/.test(rawValue)) return { kind: 'malformed', value: null, rawValue };

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1) return { kind: 'malformed', value: null, rawValue };

  return { kind: 'valid', value, rawValue };
}

export function parseCardmarketPageContext(urlValue: string = window.location.href): CardmarketPageContext {
  const url = new URL(urlValue, window.location.href);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const expansionId = parseExpansionId(url.searchParams);
  const pageNumber = parsePositiveIntegerParam(url.searchParams, 'page')
    ?? parsePositiveIntegerParam(url.searchParams, 'site');
  const sort = url.searchParams.get('sort') ?? url.searchParams.get('sortBy');
  const sortDirection = url.searchParams.get('sortDir') ?? url.searchParams.get('order');
  const sortOrder = sortDirection ? [sort, sortDirection].filter(Boolean).join(':') : sort;

  return {
    url: url.toString(),
    pathname: url.pathname,
    game: pathParts[1] ?? null,
    expansionId,
    expansionName: url.searchParams.get('expansionName'),
    rarity: url.searchParams.get('rarity') ?? url.searchParams.get('idRarity'),
    pageNumber,
    sortOrder,
    isBulkListingPage: url.pathname.endsWith('/Stock/ListingMethods/BulkListing'),
    canValidateExpansion: expansionId.kind === 'valid',
  };
}
