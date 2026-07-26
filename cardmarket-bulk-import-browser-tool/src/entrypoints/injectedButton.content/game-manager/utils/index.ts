import { compareNormalized } from '../../../../utils';

const VALID_BOOLEAN_VALUES = ['t', 'true', '1', 'y', 'yes'];

export function parseBoolean(value: string | undefined = undefined, validValues: string[] = []) {
  if (!value) return false;
  return [...VALID_BOOLEAN_VALUES, ...validValues].some((v) => compareNormalized(v, value));
}
