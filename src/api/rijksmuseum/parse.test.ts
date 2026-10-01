import { describe, expect, it } from 'vitest';

import digitalObject from '../../test/fixtures/digital-500711199912110510799100.json';
import nightWatch from '../../test/fixtures/object-200107928.json';
import rembrandt from '../../test/fixtures/person-2103429.json';
import visualItem from '../../test/fixtures/visual-202107928.json';
import { AAT } from './constants';
import {
  pickArtistIds,
  pickDateRange,
  pickDigitalObjectIds,
  pickImageUrl,
  pickObjectNumber,
  pickPreferredName,
  pickVisualItemIds,
  toThumbnailUrl,
} from './parse';

const name = (
  content: string,
  language: 'en' | 'nl' | null,
  isPreferred = false
) => ({
  type: 'Name',
  content,
  language: language ? [{ id: AAT.language[language] }] : [],
  classified_as: isPreferred ? [{ id: AAT.preferredTerm }] : [],
});

const entityWithNames = (...names: ReturnType<typeof name>[]) => ({
  identified_by: names,
});

describe('pickPreferredName', () => {
  it('picks the preferred English title of The Night Watch', () => {
    expect(pickPreferredName(nightWatch, 'en')).toBe(
      'The Night Watch Militia Company of District II under the Command of Captain Frans Banninck Cocq'
    );
  });

  it('picks the preferred Dutch title of The Night Watch', () => {
    expect(pickPreferredName(nightWatch, 'nl')).toBe('De Nachtwacht');
  });

  it('picks the preferred English artist name, not an inverted one', () => {
    expect(pickPreferredName(rembrandt, 'en')).toBe('Rembrandt van Rijn');
  });

  it('falls back to any name in the language', () => {
    const entity = entityWithNames(
      name('Preferred Dutch', 'nl', true),
      name('Any English', 'en')
    );

    expect(pickPreferredName(entity, 'en')).toBe('Any English');
  });

  it('falls back to the preferred name in any language', () => {
    const entity = entityWithNames(
      name('Other Dutch', 'nl'),
      name('Preferred Dutch', 'nl', true)
    );

    expect(pickPreferredName(entity, 'en')).toBe('Preferred Dutch');
  });

  it('falls back to the first name', () => {
    const entity = entityWithNames(name('First', null), name('Second', 'nl'));

    expect(pickPreferredName(entity, 'en')).toBe('First');
  });

  it('ignores identifiers and returns null without names', () => {
    const entity = {
      identified_by: [{ type: 'Identifier', content: 'SK-C-5' }],
    };

    expect(pickPreferredName(entity, 'en')).toBeNull();
  });
});

describe('Night Watch fixture', () => {
  it('gives the object number', () => {
    expect(pickObjectNumber(nightWatch)).toBe('SK-C-5');
  });

  it('gives the date range of 1642', () => {
    expect(pickDateRange(nightWatch)).toEqual({
      start: '1642-01-01T00:00:00Z',
      end: '1642-12-31T23:59:59Z',
    });
  });

  it('gives the artist ID', () => {
    expect(pickArtistIds(nightWatch)).toEqual([
      'https://id.rijksmuseum.nl/2103429',
    ]);
  });

  it('follows the image chain to the IIIF URL', () => {
    expect(pickVisualItemIds(nightWatch)).toEqual([
      'https://id.rijksmuseum.nl/202107928',
    ]);
    expect(pickDigitalObjectIds(visualItem)).toEqual([
      'https://id.rijksmuseum.nl/500711199912110510799100',
    ]);
    expect(pickImageUrl(digitalObject)).toBe(
      'https://iiif.micr.io/PJEZO/full/max/0/default.jpg'
    );
  });
});

describe('pickArtistIds', () => {
  it('reads artists from produced_by and its parts without duplicates', () => {
    const object = {
      produced_by: {
        carried_out_by: [{ id: 'https://id.rijksmuseum.nl/1' }],
        part: [
          { carried_out_by: [{ id: 'https://id.rijksmuseum.nl/2' }] },
          { carried_out_by: [{ id: 'https://id.rijksmuseum.nl/1' }] },
        ],
      },
    };

    expect(pickArtistIds(object)).toEqual([
      'https://id.rijksmuseum.nl/1',
      'https://id.rijksmuseum.nl/2',
    ]);
  });
});

describe('toThumbnailUrl', () => {
  it('asks IIIF for a 400 px wide image', () => {
    expect(
      toThumbnailUrl('https://iiif.micr.io/PJEZO/full/max/0/default.jpg')
    ).toBe('https://iiif.micr.io/PJEZO/full/400,/0/default.jpg');
  });

  it('keeps a URL that is not a full-size IIIF URL', () => {
    expect(toThumbnailUrl('https://example.com/image.jpg')).toBe(
      'https://example.com/image.jpg'
    );
  });
});

describe('missing or malformed fields', () => {
  it.each([[{}], [{ identified_by: 'x', produced_by: 1, shows: {} }]])(
    'gives null or [] and never throws: %o',
    (entity) => {
      expect(pickPreferredName(entity, 'en')).toBeNull();
      expect(pickObjectNumber(entity)).toBeNull();
      expect(pickDateRange(entity)).toEqual({ start: null, end: null });
      expect(pickArtistIds(entity)).toEqual([]);
      expect(pickVisualItemIds(entity)).toEqual([]);
      expect(pickDigitalObjectIds(entity)).toEqual([]);
      expect(pickImageUrl(entity)).toBeNull();
    }
  );
});
