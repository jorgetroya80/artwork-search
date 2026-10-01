import { useState } from 'react';

type ArtworkImageProps = {
  src: string | null;
  alt: string;
};

const FRAME_CLASSES = 'aspect-[4/3] w-full bg-bg-subtle';

export function ArtworkImage({ src, alt }: ArtworkImageProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (!src || hasFailed) {
    return (
      <div
        className={`${FRAME_CLASSES} flex items-center justify-center p-4 text-center text-sm text-fg-muted`}
      >
        Image not available
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasFailed(true)}
      className={`${FRAME_CLASSES} object-cover`}
    />
  );
}
