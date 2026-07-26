import { scanCardmarketPageRows } from '../../cardmarket/rowScanner';
import { cardmarketSelectors } from '../../cardmarket/selectors';

export function getWebsiteRows() {
  return scanCardmarketPageRows().map((row) => row.productLinkElement);
}

// Selectors for the fields from the tr Element for each row
export const languageElSelector = cardmarketSelectors.languageInput;
export const conditionElSelector = cardmarketSelectors.conditionInput;
export const signedElSelector = cardmarketSelectors.signedInput;
export const commentElSelector = cardmarketSelectors.commentInput;
export const quantityElSelector = cardmarketSelectors.quantityInput;
export const priceElSelector = cardmarketSelectors.priceInput;
