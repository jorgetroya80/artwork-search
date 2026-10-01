import type { Artwork, ArtworkResult } from '../../api/rijksmuseum';
import { Button } from '../../components/ui';
import { ArtworkImage } from './ArtworkImage';
import { formatDateRange } from './formatDateRange';

const CARD_CLASSES =
  'flex h-full flex-col overflow-hidden rounded-control border border-border bg-bg';

type ArtworkCardProps = {
  result: ArtworkResult;
};

export function ArtworkCard({ result }: ArtworkCardProps) {
  switch (result.status) {
    case 'pending':
      return <ArtworkCardSkeleton />;
    case 'error':
      return <ArtworkCardError onRetry={result.retry} />;
    case 'success':
      return <ArtworkCardContent artwork={result.artwork} />;
  }
}

export function ArtworkCardSkeleton() {
  return (
    <article aria-label="Loading artwork" aria-busy className={CARD_CLASSES}>
      <div className="aspect-4/3 w-full bg-bg-subtle motion-safe:animate-pulse" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-4 w-3/4 rounded-control bg-bg-subtle motion-safe:animate-pulse" />
        <div className="h-4 w-1/2 rounded-control bg-bg-subtle motion-safe:animate-pulse" />
      </div>
    </article>
  );
}

function ArtworkCardError({ onRetry }: { onRetry: () => void }) {
  return (
    <article
      className={`${CARD_CLASSES} items-center justify-center gap-3 p-4 text-center`}
    >
      <p className="text-fg-muted">This artwork could not be loaded.</p>
      <Button onClick={onRetry}>Retry</Button>
    </article>
  );
}

function ArtworkCardContent({ artwork }: { artwork: Artwork }) {
  const date = formatDateRange(artwork.date);

  return (
    <article className={CARD_CLASSES}>
      <ArtworkImage src={artwork.thumbnailUrl} alt={artwork.title} />
      <div className="flex flex-col gap-1 p-3 wrap-break-word">
        <h2 title={artwork.title} className="line-clamp-2 font-semibold">
          {artwork.title}
        </h2>
        {artwork.artists.length > 0 && (
          <p className="text-sm text-fg-muted">{artwork.artists.join(', ')}</p>
        )}
        {date && <p className="text-sm text-fg-muted">{date}</p>}
      </div>
    </article>
  );
}
