import { toImageUrl, useArtwork, type Artwork } from '../../api/rijksmuseum';
import { formatDateRange } from './formatDateRange';

// The entity id fetchArtwork expects: the Rijksmuseum object URL, not the bare object number.
export const FEATURED_ARTWORK_ID = 'https://id.rijksmuseum.nl/200107928';
export const FEATURED_IMAGE_WIDTH = 1200;

function FeaturedCaption({ artwork }: { artwork: Artwork }) {
  const date = formatDateRange(artwork.date);

  return (
    <figcaption className="flex items-baseline justify-between gap-4 font-mono text-xs text-fg-muted">
      <span>{[artwork.title, ...artwork.artists].join(', ')}</span>
      {date ? <span>{date}</span> : null}
    </figcaption>
  );
}

export function FeaturedArtwork() {
  const { data: artwork, status } = useArtwork(FEATURED_ARTWORK_ID);
  const image =
    artwork?.imageUrl &&
    ({
      src: toImageUrl(artwork.imageUrl, FEATURED_IMAGE_WIDTH),
      alt: artwork.title,
    } as const);

  return (
    <figure className="flex flex-col gap-3">
      {/* Decoration: on error it stays an empty box, with no alert */}
      <div
        className={`h-70 bg-bg-subtle sm:min-h-110 sm:flex-1 ${
          status === 'pending' ? 'motion-safe:animate-pulse' : ''
        }`}
      >
        {image ? (
          <img
            src={image.src}
            alt={image.alt}
            className="size-full object-cover"
          />
        ) : null}
      </div>
      {artwork && status === 'success' ? (
        <FeaturedCaption artwork={artwork} />
      ) : null}
    </figure>
  );
}
