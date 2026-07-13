import memoize from 'memoize';
import { sendMessage } from 'webext-bridge/content-script';
import * as yup from 'yup';

import GenericGameManager from './generic';
import type { BaseColumnMapping, CommonParsedRowFields } from './generic';
import { compareNormalized } from '../../../../utils';
import type { TranslationKey } from '../../../../utils';
import { parseCardmarketPageContext } from '../../cardmarket/pageContext';
import { cardmarketSelectors } from '../../cardmarket/selectors';
import { parseBoolean } from '../utils';

async function getMTGJSONDataImpl() {
  // We can't fetch inside the content script, so we delegate to the background with messages
  return sendMessage('cardmarket-bulk-import.getMTGJSONData', undefined, 'background');
}

const getMTGJSONData = memoize(getMTGJSONDataImpl);

async function matchSetToCardmarketIdImpl(set: string) {
  const sets = await getMTGJSONData();
  const result = sets.find(({ matchKeys }) => !!matchKeys.find((v) => compareNormalized(v, set)));
  if (result) return { code: result.code, cardmarketId: result.cardmarketId };
  return null;
}

const matchSetToCardmarketId = memoize(matchSetToCardmarketIdImpl);

const foilElSelector = cardmarketSelectors.foilInput;

class MtgGameManager extends GenericGameManager<'set' | 'isFoil', { set: string, isFoil: boolean }> {
  extraColumns: Record<'set' | 'isFoil', TranslationKey> = {
    set: 'injectedButton.gameManagers.mtg.importCsvForm.set.label',
    isFoil: 'injectedButton.gameManagers.mtg.importCsvForm.isFoil.label',
  };

  extraValidationSchema = yup.object({
    set: yup.string(),
    isFoil: yup.string(),
  });

  async parseRow(
    id: number,
    rawRowData: Record<string, unknown>,
    columnMapping: BaseColumnMapping & { set: string | undefined, isFoil: string | undefined },
  ) {
    const parsedData = await super.parseRow(id, rawRowData, columnMapping);
    let set = columnMapping['set'] ? String(rawRowData[columnMapping['set']]) : '';
    let enabled = parsedData.enabled;
    if (set) {
      const pageContext = parseCardmarketPageContext();
      const data = await matchSetToCardmarketId(set);
      if (data) {
        set = data.code;
        if (
          pageContext.expansionId.kind === 'valid'
          && data.cardmarketId !== pageContext.expansionId.value
        ) enabled = false;
      }
      else {
        set = '';
      }
    }
    return {
      ...parsedData,
      set: set,
      isFoil: !!columnMapping['isFoil']
        && parseBoolean(String(rawRowData[columnMapping['isFoil']]), ['foil']),
      enabled,
    };
  }

  async fillRow(
    trEl: HTMLTableRowElement,
    row: (CommonParsedRowFields & { set: string, isFoil: boolean }),
  ): Promise<HTMLTableRowElement> {
    const resolvedEl = await super.fillRow(trEl, row);
    const foilEl: HTMLInputElement = resolvedEl.querySelector(foilElSelector)!;
    foilEl.checked = row.isFoil;
    return resolvedEl;
  };

  extraTableColumns: Record<'set' | 'isFoil', TranslationKey> = {
    set: 'injectedButton.gameManagers.mtg.selectRowsFormTable.set',
    isFoil: 'injectedButton.gameManagers.mtg.selectRowsFormTable.isFoil',
  };
};

export default MtgGameManager;
