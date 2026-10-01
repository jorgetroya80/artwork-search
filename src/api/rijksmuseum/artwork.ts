import { fetchJson } from './http';
import {
  pickArtists,
  pickDateRange,
  pickDigitalObjectIds,
  pickImageUrl,
  pickObjectNumber,
  pickPreferredName,
  pickVisualItemIds,
  toThumbnailUrl,
  type ArtistRef,
} from './parse';
import type { Artwork } from './types';

export type FetchEntity = (
  url: string,
  signal?: AbortSignal
) => Promise<unknown>;
type LoadEntity = (url: string) => Promise<unknown>;

type FetchArtworkOptions = {
  signal?: AbortSignal;
  /** Loads linked entities (artists, image chain). The hooks pass a cached loader. */
  fetchEntity?: FetchEntity;
};

const UNTITLED = 'Untitled';

export const fetchLinkedArt: FetchEntity = (url, signal) =>
  fetchJson(url, { signal, accept: 'application/ld+json' });

export async function fetchArtwork(
  id: string,
  { signal, fetchEntity = fetchLinkedArt }: FetchArtworkOptions = {}
): Promise<Artwork> {
  const object = await fetchLinkedArt(id, signal);
  const loadEntity: LoadEntity = (url) => fetchEntity(url, signal);
  const [artists, imageUrl] = await Promise.all([
    resolveArtistNames(pickArtists(object), loadEntity),
    resolveImageUrl(object, loadEntity),
  ]);
  // Partial results are swallowed above, so a cancellation must be surfaced here.
  signal?.throwIfAborted();

  return {
    id,
    objectNumber: pickObjectNumber(object),
    title: pickPreferredName(object) ?? UNTITLED,
    artists,
    date: pickDateRange(object),
    imageUrl,
    thumbnailUrl: imageUrl && toThumbnailUrl(imageUrl),
  };
}

const loadArtistName = async (
  { id, name }: ArtistRef,
  loadEntity: LoadEntity
) => name ?? pickPreferredName(await loadEntity(id));

async function resolveArtistNames(
  artists: ArtistRef[],
  loadEntity: LoadEntity
) {
  const results = await Promise.allSettled(
    artists.map((artist) => loadArtistName(artist, loadEntity))
  );
  const names = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  );
  return [...new Set(names)];
}

async function resolveImageUrl(object: unknown, loadEntity: LoadEntity) {
  try {
    const [visualItemId] = pickVisualItemIds(object);
    if (!visualItemId) return null;
    const [digitalObjectId] = pickDigitalObjectIds(
      await loadEntity(visualItemId)
    );
    if (!digitalObjectId) return null;
    return pickImageUrl(await loadEntity(digitalObjectId));
  } catch {
    return null;
  }
}
