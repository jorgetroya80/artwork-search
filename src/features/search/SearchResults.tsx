import { PAGE_SIZE, type useArtworkSearch } from '../../api/rijksmuseum';
import { Button } from '../../components/ui';
import { ArtworkCard, ArtworkCardSkeleton } from './ArtworkCard';
import { ErrorMessage } from './ErrorMessage';
import { getErrorMessage } from './getErrorMessage';

type ArtworkSearch = ReturnType<typeof useArtworkSearch>;

type SearchResultsProps = {
  search: ArtworkSearch;
};

const GRID_CLASSES =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

const SKELETON_KEYS = Array.from(
  { length: PAGE_SIZE },
  (_, index) => `skeleton-${index}`
);

const EMPTY_TEXT = 'No results found. Try another search term.';

const formatCount = (count: number) => count.toLocaleString('en-US');

function getStatusText({ status, artworks, total, isEmpty }: ArtworkSearch) {
  if (isEmpty) return EMPTY_TEXT;
  if (status !== 'success' || total === null) return '';
  const noun = total === 1 ? 'result' : 'results';
  return `Showing ${formatCount(artworks.length)} of ${formatCount(total)} ${noun}`;
}

function SkeletonGrid() {
  return (
    <ul aria-busy className={GRID_CLASSES}>
      {SKELETON_KEYS.map((key) => (
        <li key={key}>
          <ArtworkCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

function ResultGrid({ artworks }: Pick<ArtworkSearch, 'artworks'>) {
  return (
    <ul className={GRID_CLASSES}>
      {artworks.map((result) => (
        <li key={result.id}>
          <ArtworkCard result={result} />
        </li>
      ))}
    </ul>
  );
}

function LoadMore({
  loadMore,
  isLoadingMore,
  loadMoreError,
}: Pick<ArtworkSearch, 'loadMore' | 'isLoadingMore' | 'loadMoreError'>) {
  return (
    <div className="flex flex-col items-center gap-2">
      {loadMoreError && (
        <p role="alert" className="text-sm text-fg-muted">
          {getErrorMessage(loadMoreError)}
        </p>
      )}
      <Button pending={isLoadingMore} onClick={loadMore}>
        {isLoadingMore ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  );
}

export function SearchResults({ search }: SearchResultsProps) {
  return (
    <section className="flex flex-col gap-4">
      <p role="status" className="text-sm text-fg-muted">
        {getStatusText(search)}
      </p>
      {search.status === 'pending' && <SkeletonGrid />}
      {search.error && (
        <ErrorMessage error={search.error} onRetry={search.retry} />
      )}
      {search.status === 'success' && !search.isEmpty && (
        <ResultGrid artworks={search.artworks} />
      )}
      {search.hasMore && (
        <LoadMore
          loadMore={search.loadMore}
          isLoadingMore={search.isLoadingMore}
          loadMoreError={search.loadMoreError}
        />
      )}
    </section>
  );
}
