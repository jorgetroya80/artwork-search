import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PAGE_SIZE } from '../../api/rijksmuseum';
import { SEARCH_URL } from '../../api/rijksmuseum/constants';
import {
  generatedObjectId,
  makeGeneratedObject,
  makeSearchPage,
} from '../../test/msw/factories';
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
  it('has one main landmark, one h1 and a search form', () => {
    renderPage();

    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('search')).toBeDefined();
  });

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

describe('SearchPage results grid', () => {
  it('shows skeletons, then the first 10 artworks', async () => {
    renderPage();
    typeTerm('Rembrandt');
    pressEnter();

    expect(
      screen.getAllByRole('article', { name: 'Loading artwork', busy: true })
    ).toHaveLength(PAGE_SIZE);

    await screen.findByText('Showing 10 of 23 results');
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10)
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getAllByText('Test Artist')).toHaveLength(10);
  });

  it('fails only the artwork that could not be loaded, and retries it', async () => {
    const failedId = generatedObjectId(2);
    let failures = 0;
    renderPage();
    // Registered after the generated handlers, so it takes precedence.
    server.use(
      http.get(failedId, () => {
        failures += 1;
        if (failures <= 1) return new HttpResponse(null, { status: 400 });
        return HttpResponse.json(makeGeneratedObject(failedId));
      })
    );
    typeTerm('Rembrandt');
    pressEnter();

    await screen.findByText('This artwork could not be loaded.');
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9)
    );

    const failedItem = screen
      .getByText('This artwork could not be loaded.')
      .closest('li');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // The Retry button leaves the card during the retry, so focus stays on the card's item.
    expect(document.activeElement).toBe(failedItem);
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10)
    );
    expect(document.activeElement).toBe(failedItem);
    expect(screen.queryByText('This artwork could not be loaded.')).toBeNull();
  });
});

describe('SearchPage empty and error states', () => {
  const GENERIC = 'Something went wrong. Please try again.';
  const failSearch = (status: number) =>
    server.use(http.get(SEARCH_URL, () => new HttpResponse(null, { status })));

  it('shows the empty message when nothing matches', async () => {
    renderPage(0);
    typeTerm('Nobody');
    pressEnter();

    expect(
      await screen.findByText('No results found. Try another search term.')
    ).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it.each([500, 400])(
    'shows the generic error for %i and recovers with Try again',
    async (status) => {
      renderPage();
      failSearch(status);
      typeTerm('Rembrandt');
      pressEnter();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(GENERIC);

      server.resetHandlers(...generatedSearchHandlers(23));
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      // The button leaves the page during the retry, so focus moves to a stable region.
      expect(document.activeElement).toBe(
        screen.getByRole('region', { name: 'Search results' })
      );
      expect(await screen.findByText('Showing 10 of 23 results')).toBeDefined();
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );

  it('asks to try later when the service answers 429', async () => {
    renderPage();
    failSearch(429);
    typeTerm('Rembrandt');
    pressEnter();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The service is not available right now. Please try again later.'
    );
  });

  it('retries when the same term is submitted after an error', async () => {
    renderPage();
    failSearch(400);
    typeTerm('Rembrandt');
    pressEnter();
    await screen.findByRole('alert');

    const [, entityHandler] = generatedSearchHandlers(23);
    let releaseSearch = () => {};
    const searchGate = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });
    server.resetHandlers(
      http.get(SEARCH_URL, async () => {
        await searchGate;
        return HttpResponse.json(makeSearchPage({ total: 23, pageIndex: 0 }));
      }),
      entityHandler
    );
    pressEnter();

    expect(
      await screen.findByRole('button', { name: 'Searching…' })
    ).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();

    releaseSearch();
    expect(await screen.findByText('Showing 10 of 23 results')).toBeDefined();
  });
});

describe('SearchPage load more', () => {
  const headingCount = () =>
    screen.queryAllByRole('heading', { level: 2 }).length;
  const getLoadMore = () =>
    screen.getByRole('button', { name: /^(Load more|Loading…)$/ });

  async function searchAndWait(total: number) {
    renderPage(total);
    typeTerm('Rembrandt');
    pressEnter();
    await waitFor(() =>
      expect(headingCount()).toBe(Math.min(total, PAGE_SIZE))
    );
  }

  async function loadMoreUntil(count: number) {
    while (headingCount() < count) {
      const expected = headingCount() + PAGE_SIZE;
      fireEvent.click(getLoadMore());
      await waitFor(() => expect(headingCount()).toBe(expected));
    }
  }

  it('adds 10 artworks per click and hides the button after the last batch', async () => {
    await searchAndWait(23);
    const firstTitle = screen.getAllByRole('heading', { level: 2 })[0]
      .textContent;

    fireEvent.click(getLoadMore());
    await waitFor(() => expect(headingCount()).toBe(20));
    expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toBe(
      firstTitle
    );
    expect(screen.getByText('Showing 20 of 23 results')).toBeDefined();

    fireEvent.click(getLoadMore());
    await waitFor(() => expect(headingCount()).toBe(23));
    expect(
      screen.queryByRole('button', { name: /^(Load more|Loading…)$/ })
    ).toBeNull();
  });

  it('has no Load more button when every result is shown', async () => {
    await searchAndWait(7);

    expect(
      screen.queryByRole('button', { name: /^(Load more|Loading…)$/ })
    ).toBeNull();
  });

  it('keeps the list on a failed next page and recovers on the next click', async () => {
    await searchAndWait(150);
    await loadMoreUntil(100);

    let releaseSearch = () => {};
    const searchGate = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });
    server.use(
      http.get(SEARCH_URL, async () => {
        await searchGate;
        return new HttpResponse(null, { status: 500 });
      })
    );
    getLoadMore().focus();
    fireEvent.click(getLoadMore());

    expect(
      await screen.findByRole('button', { name: 'Loading…' })
    ).toBeDefined();
    expect(document.activeElement).toBe(getLoadMore());

    releaseSearch();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Please try again.'
    );
    expect(headingCount()).toBe(100);
    expect(getLoadMore().textContent).toBe('Load more');

    server.resetHandlers(...generatedSearchHandlers(150));
    fireEvent.click(getLoadMore());

    await waitFor(() => expect(headingCount()).toBe(110));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
