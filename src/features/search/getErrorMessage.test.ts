import { describe, expect, it } from 'vitest';

import { RijksApiError, type RijksApiErrorKind } from '../../api/rijksmuseum';
import { getErrorMessage } from './getErrorMessage';

const GENERIC = 'Something went wrong. Please try again.';
const UNAVAILABLE =
  'The service is not available right now. Please try again later.';

const makeError = (kind: RijksApiErrorKind, status: number | null = null) =>
  new RijksApiError('test', { kind, status, url: 'https://example.test' });

describe('getErrorMessage', () => {
  it('asks to try later for 429', () => {
    expect(getErrorMessage(makeError('http', 429))).toBe(UNAVAILABLE);
  });

  it.each([
    ['http 500', makeError('http', 500)],
    ['http 400', makeError('http', 400)],
    ['network', makeError('network')],
    ['timeout', makeError('timeout')],
    ['parse', makeError('parse')],
  ])('uses the generic message for %s', (_, error) => {
    expect(getErrorMessage(error)).toBe(GENERIC);
  });
});
