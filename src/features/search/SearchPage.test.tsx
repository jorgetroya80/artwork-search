import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SEARCH_URL } from '../../api/rijksmuseum/constants';
import { generatedSearchHandlers } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderWithClient } from '../../test/render';
import { SearchPage } from './SearchPage';

const searchUrls: URL[] = [];
const recordSearch = ({ request }: { request: Request }) => {
  if (request.url.startsWith(SEARCH_URL)) searchUrls.push(new URL(request.url));
};

beforeEach(() => {
  searchUrls.length = 0;
  server.events.on('request:start', recordSearch);
});

afterEach(() => {
  server.events.removeListener('request:start', recordSearch);
});

const getInput = () => screen.getByRole('searchbox', { name: 'Artist name' });
const getSearchButton = () =>
  screen.getByRole('button', { name: /^(Search|Searching…)$/ });
const typeTerm = (term: string) =>
  fireEvent.change(getInput(), { target: { value: term } });
const pressEnter = () => fireEvent.submit(screen.getByRole('search'));
const flushRequests = () => act(async () => {});

function renderPage(total = 23) {
  server.use(...generatedSearchHandlers(total));
  return renderWithClient(<SearchPage />);
}

describe('SearchPage form', () => {
  it('describes the input with the full-name hint', () => {
    renderPage();

    expect(
      screen.getByRole('searchbox', {
        name: 'Artist name',
        description: 'Use the full name, e.g. "Rembrandt"',
      })
    ).toBeDefined();
  });

  it.each(['', '   '])('keeps Search disabled for %j', async (term) => {
    renderPage();

    typeTerm(term);
    pressEnter();
    await flushRequests();

    expect((getSearchButton() as HTMLButtonElement).disabled).toBe(true);
    expect(searchUrls).toHaveLength(0);
  });

  it('searches by creator only when Search is clicked', async () => {
    renderPage();

    typeTerm('  Rembrandt  ');
    fireEvent.click(getSearchButton());
    await screen.findByText('Showing 10 of 23 results');

    expect(searchUrls).toHaveLength(1);
    expect(searchUrls[0].searchParams.get('creator')).toBe('Rembrandt');
    expect(searchUrls[0].searchParams.has('title')).toBe(false);
  });

  it('searches when Enter submits the form', async () => {
    renderPage();

    typeTerm('Rembrandt');
    pressEnter();
    await screen.findByText('Showing 10 of 23 results');

    expect(searchUrls).toHaveLength(1);
  });

  it('shows Searching… and keeps focus while the search runs', async () => {
    renderPage();
    typeTerm('Rembrandt');
    getSearchButton().focus();

    fireEvent.click(getSearchButton());

    expect(getSearchButton().textContent).toBe('Searching…');
    expect(getSearchButton().getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(getSearchButton());

    await screen.findByText('Showing 10 of 23 results');
    expect(getSearchButton().textContent).toBe('Search');
    expect(getSearchButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('ignores a second submit while the search runs', async () => {
    renderPage();
    typeTerm('Rembrandt');
    pressEnter();

    typeTerm('Vermeer');
    fireEvent.click(getSearchButton());
    pressEnter();
    await screen.findByText('Showing 10 of 23 results');

    expect(searchUrls).toHaveLength(1);
    expect(searchUrls[0].searchParams.get('creator')).toBe('Rembrandt');
  });

  it('sends no request when the same term is submitted after success', async () => {
    renderPage();
    typeTerm('Rembrandt');
    pressEnter();
    await screen.findByText('Showing 10 of 23 results');

    typeTerm('Rembrandt ');
    pressEnter();
    await flushRequests();

    expect(searchUrls).toHaveLength(1);
  });
});

describe('SearchPage status line', () => {
  it('uses the singular for one result', async () => {
    renderPage(1);

    typeTerm('Rembrandt');
    pressEnter();

    expect(await screen.findByText('Showing 1 of 1 result')).toBeDefined();
  });

  it('formats large totals in en-US', async () => {
    renderPage(1423);

    typeTerm('Rembrandt');
    pressEnter();

    expect(
      await screen.findByText('Showing 10 of 1,423 results')
    ).toBeDefined();
  });

  it('keeps the live region in the page before any search', () => {
    renderPage();

    expect(screen.getByRole('status').textContent).toBe('');
  });
});
