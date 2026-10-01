import { describe, expect, it } from 'vitest';

import nightWatch from '../fixtures/object-200107928.json';
import nachtwachtSearch from '../fixtures/search-rembrandt-nachtwacht.json';
import { SEARCH_URL } from './factories';

describe('default handlers', () => {
  it('serve the search fixture that matches the query', async () => {
    const response = await fetch(
      `${SEARCH_URL}?creator=Rembrandt&title=Nachtwacht&imageAvailable=true`
    );

    expect(await response.json()).toEqual(nachtwachtSearch);
  });

  it('serve the entity fixture that matches the id', async () => {
    const response = await fetch('https://id.rijksmuseum.nl/200107928');

    expect(await response.json()).toEqual(nightWatch);
  });

  it('answer 400 for an unknown id, like the real API', async () => {
    const response = await fetch('https://id.rijksmuseum.nl/1');

    expect(response.status).toBe(400);
  });

  it('answer 404 for a search without a fixture', async () => {
    const response = await fetch(`${SEARCH_URL}?title=unknown`);

    expect(response.status).toBe(404);
  });
});
