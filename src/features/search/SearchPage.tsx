import { useState } from 'react';

import { normalizeSearchInput, useArtworkSearch } from '../../api/rijksmuseum';
import { SearchForm } from './SearchForm';
import { SearchResults } from './SearchResults';

export function SearchPage() {
  const [draft, setDraft] = useState('');
  const [submittedTerm, setSubmittedTerm] = useState('');
  const search = useArtworkSearch({ creator: submittedTerm });
  const isSearching = search.status === 'pending';
  const term = normalizeSearchInput({ creator: draft })?.creator;

  function handleSubmit() {
    if (!term || isSearching) return;
    // Same input means the hook does not change, so a failed search must be retried by hand.
    if (term === submittedTerm && search.status === 'error') {
      search.retry();
      return;
    }
    setSubmittedTerm(term);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Artwork search</h1>
      <SearchForm
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        canSubmit={Boolean(term)}
        isSearching={isSearching}
      />
      <SearchResults search={search} />
    </main>
  );
}
