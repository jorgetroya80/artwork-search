import type { useArtworkSearch } from '../../api/rijksmuseum';

type ArtworkSearch = ReturnType<typeof useArtworkSearch>;

type SearchResultsProps = {
  search: ArtworkSearch;
};

const formatCount = (count: number) => count.toLocaleString('en-US');

function getStatusText({ status, artworks, total }: ArtworkSearch) {
  if (status !== 'success' || total === null) return '';
  const noun = total === 1 ? 'result' : 'results';
  return `Showing ${formatCount(artworks.length)} of ${formatCount(total)} ${noun}`;
}

export function SearchResults({ search }: SearchResultsProps) {
  return (
    <section className="flex flex-col gap-4">
      <p role="status" className="text-sm text-fg-muted">
        {getStatusText(search)}
      </p>
    </section>
  );
}
