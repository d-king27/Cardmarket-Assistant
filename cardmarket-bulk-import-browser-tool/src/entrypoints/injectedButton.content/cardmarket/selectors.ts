export const cardmarketSelectors = {
  productLink: 'td div.col-product.text-start a',
  languageInput: 'td select[name^="idLanguage"]',
  conditionInput: 'td select[name^="idCondition"]',
  signedInput: 'td input[name^="isSigned"]',
  commentInput: 'td input[name^="comments"]',
  quantityInput: 'td input[name^="amount"]',
  priceInput: 'td input[name^="price"]',
  foilInput: 'td input[name^="isFoil"]',
  copyRowButton: 'td button.copy-row-button',
} as const;
