import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchForm } from './SearchForm';

const HINT = 'Use the full name, e.g. "Rembrandt"';

function renderForm(props: Partial<Parameters<typeof SearchForm>[0]> = {}) {
  render(
    <SearchForm
      value=""
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      canSubmit={false}
      isSearching={false}
      {...props}
    />
  );
}

describe('SearchForm', () => {
  it('numbers the label and shows the hint in the idle (non-compact) form', () => {
    renderForm();

    expect(
      screen.getByRole('searchbox', { name: '01 — Artist name' })
    ).toBeDefined();
    expect(screen.getByText(HINT)).toBeDefined();
  });

  it('drops the numbering and the hint in the compact form', () => {
    renderForm({ compact: true });

    expect(
      screen.getByRole('searchbox', { name: 'Artist name' })
    ).toBeDefined();
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it.each([true, false])(
    'names the button Search when compact is %s',
    (compact) => {
      renderForm({ compact });

      expect(screen.getByRole('button', { name: 'Search' })).toBeDefined();
    }
  );

  it.each([true, false])(
    'shows Searching… while pending, compact %s',
    (compact) => {
      renderForm({ compact, isSearching: true });

      expect(screen.getByRole('button', { name: 'Searching…' })).toBeDefined();
    }
  );
});
