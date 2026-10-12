import { useEffect, useRef, useState } from 'react';

import { normalizeSearchInput, useArtworkSearch } from '../../api/rijksmuseum';
import { Layout } from '../../components/layout/Layout';
import { FeaturedArtwork } from './FeaturedArtwork';
import { SearchForm } from './SearchForm';
import { SearchResults } from './SearchResults';

export function SearchPage() {
  const [draft, setDraft] = useState('');
  const [submittedTerm, setSubmittedTerm] = useState('');
  const search = useArtworkSearch({ creator: submittedTerm });
  const isSearching = search.status === 'pending';
  const term = normalizeSearchInput({ creator: draft })?.creator;
  const isSearchState = submittedTerm !== '';

  // The compact form mounts in a different part of the tree (Layout's toolbar
  // slot), so submitting the first search loses focus to the old, now-unmounted
  // control. Remember what kind of control had it, and restore it there.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const focusKindRef = useRef<'input' | 'button' | null>(null);
  const wasSearchStateRef = useRef(isSearchState);

  useEffect(() => {
    if (isSearchState && !wasSearchStateRef.current && focusKindRef.current) {
      toolbarRef.current?.querySelector(focusKindRef.current)?.focus();
      focusKindRef.current = null;
    }
    wasSearchStateRef.current = isSearchState;
  }, [isSearchState]);

  function handleSubmit() {
    if (!term || isSearching) return;
    // Same input means the hook does not change, so a failed search must be retried by hand.
    if (term === submittedTerm && search.status === 'error') {
      search.retry();
      return;
    }
    const active = document.activeElement?.tagName;
    focusKindRef.current =
      active === 'INPUT' ? 'input' : active === 'BUTTON' ? 'button' : null;
    setSubmittedTerm(term);
  }

  const form = (
    <SearchForm
      value={draft}
      onChange={setDraft}
      onSubmit={handleSubmit}
      canSubmit={Boolean(term)}
      isSearching={isSearching}
      compact={isSearchState}
    />
  );

  return (
    <Layout
      toolbar={
        isSearchState ? (
          <div className="mx-auto w-full max-w-6xl px-4 py-2" ref={toolbarRef}>
            {form}
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {isSearchState ? (
          <>
            <h1 className="sr-only">Search the collection.</h1>
            <SearchResults search={search} submittedTerm={submittedTerm} />
          </>
        ) : (
          <div className="flex flex-wrap gap-10 sm:gap-12">
            <div className="flex min-w-70 flex-[999_1_560px] flex-col gap-6">
              <h1 className="text-3xl font-semibold">Search the collection.</h1>
              {form}
            </div>
            <div className="flex flex-[1_1_380px] flex-col">
              <FeaturedArtwork />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
