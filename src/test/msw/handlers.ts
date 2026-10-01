import { http, HttpResponse } from 'msw';

import digitalObject from '../fixtures/digital-500711199912110510799100.json';
import nightWatch from '../fixtures/object-200107928.json';
import rembrandt from '../fixtures/person-2103429.json';
import searchEmpty from '../fixtures/search-empty.json';
import searchNachtwacht from '../fixtures/search-rembrandt-nachtwacht.json';
import searchRembrandtPage1 from '../fixtures/search-rembrandt-page1.json';
import visualItem from '../fixtures/visual-202107928.json';
import { SEARCH_URL } from './factories';

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

  http.get('https://id.rijksmuseum.nl/:id', ({ params }) => {
    const fixture = entityFixtures[String(params.id)];
    if (!fixture) {
      return HttpResponse.json({ detail: 'Unknown id' }, { status: 400 });
    }
    return HttpResponse.json(fixture);
  }),
];
