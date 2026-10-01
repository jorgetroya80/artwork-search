import { http, HttpResponse } from 'msw';

import { ENTITY_URL_PREFIX, SEARCH_URL } from '../../api/rijksmuseum/constants';
import digitalObject from '../fixtures/digital-500711199912110510799100.json';
import nightWatch from '../fixtures/object-200107928.json';
import rembrandt from '../fixtures/person-2103429.json';
import searchEmpty from '../fixtures/search-empty.json';
import searchNachtwacht from '../fixtures/search-rembrandt-nachtwacht.json';
import searchRembrandtPage1 from '../fixtures/search-rembrandt-page1.json';
import visualItem from '../fixtures/visual-202107928.json';
import {
  isGeneratedObjectId,
  makeGeneratedObject,
  makeSearchPage,
  pageIndexFromToken,
} from './factories';

const searchFixtures: Record<string, object> = {
  'creator=Rembrandt&title=Nachtwacht': searchNachtwacht,
  'creator=Rembrandt': searchRembrandtPage1,
  'title=zzqqxx': searchEmpty,
};

const entityFixtures: Record<string, object> = {
  '200107928': nightWatch,
  '2103429': rembrandt,
  '202107928': visualItem,
  '500711199912110510799100': digitalObject,
};

const toSearchKey = (url: URL) =>
  ['creator', 'title']
    .filter((name) => url.searchParams.has(name))
    .map((name) => `${name}=${url.searchParams.get(name)}`)
    .join('&');

export const handlers = [
  http.get(SEARCH_URL, ({ request }) => {
    const key = toSearchKey(new URL(request.url));
    const fixture = searchFixtures[key];
    if (!fixture) {
      return HttpResponse.json(
        { detail: `No fixture for ${key}` },
        { status: 404 }
      );
    }
    return HttpResponse.json(fixture);
  }),

  http.get(`${ENTITY_URL_PREFIX}:id`, ({ params }) => {
    const fixture = entityFixtures[String(params.id)];
    if (!fixture) {
      return HttpResponse.json({ detail: 'Unknown id' }, { status: 400 });
    }
    return HttpResponse.json(fixture);
  }),
];

/** Any search returns `total` generated results, and generated objects resolve. */
export const generatedSearchHandlers = (total: number) => [
  http.get(SEARCH_URL, ({ request }) => {
    const token = new URL(request.url).searchParams.get('pageToken');
    const pageIndex = pageIndexFromToken(token);
    return HttpResponse.json(makeSearchPage({ total, pageIndex }));
  }),

  http.get(`${ENTITY_URL_PREFIX}:id`, ({ params, request }) => {
    if (!isGeneratedObjectId(Number(params.id))) return undefined;
    return HttpResponse.json(makeGeneratedObject(request.url));
  }),
];
