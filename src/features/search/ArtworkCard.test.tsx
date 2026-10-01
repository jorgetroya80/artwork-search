import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RijksApiError, type Artwork } from '../../api/rijksmuseum';
import { ArtworkCard } from './ArtworkCard';

const NIGHT_WATCH: Artwork = {
  id: 'https://id.rijksmuseum.nl/200107928',
  objectNumber: 'SK-C-5',
  title: 'The Night Watch',
  artists: ['Rembrandt van Rijn', 'Studio of Rembrandt'],
  date: { start: '1642-01-01', end: '1642-12-31' },
  imageUrl: 'https://iiif.micr.io/PJEZO/full/max/0/default.jpg',
  thumbnailUrl: 'https://iiif.micr.io/PJEZO/full/400,/0/default.jpg',
};

const renderArtwork = (artwork: Partial<Artwork> = {}) =>
  render(
    <ArtworkCard
      result={{
        id: NIGHT_WATCH.id,
        status: 'success',
        artwork: { ...NIGHT_WATCH, ...artwork },
      }}
    />
  );

describe('ArtworkCard', () => {
  it('shows title, artists, date and thumbnail', () => {
    renderArtwork();

    const title = screen.getByRole('heading', {
      level: 2,
      name: 'The Night Watch',
    });
    const image = screen.getByRole<HTMLImageElement>('img', {
      name: 'The Night Watch',
    });

    expect(title.getAttribute('title')).toBe('The Night Watch');
    expect(
      screen.getByText('Rembrandt van Rijn, Studio of Rembrandt')
    ).toBeDefined();
    expect(screen.getByText('1642')).toBeDefined();
    expect(image.getAttribute('src')).toBe(NIGHT_WATCH.thumbnailUrl);
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('hides artists and date when unknown', () => {
    renderArtwork({ artists: [], date: { start: null, end: null } });

    expect(screen.getByRole('article').textContent).toBe('The Night Watch');
  });

  it('shows the placeholder when there is no thumbnail', () => {
    renderArtwork({ thumbnailUrl: null });

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Image not available')).toBeDefined();
  });

  it('shows the placeholder when the image fails to load', () => {
    renderArtwork();

    fireEvent.error(screen.getByRole('img'));

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Image not available')).toBeDefined();
  });

  it('shows a busy skeleton while pending', () => {
    render(<ArtworkCard result={{ id: NIGHT_WATCH.id, status: 'pending' }} />);

    expect(
      screen.getByRole('article', { name: 'Loading artwork', busy: true })
    ).toBeDefined();
  });

  it('offers a retry when the artwork failed', () => {
    const retry = vi.fn();
    const error = new RijksApiError('test', {
      kind: 'http',
      status: 500,
      url: NIGHT_WATCH.id,
    });
    render(
      <ArtworkCard
        result={{ id: NIGHT_WATCH.id, status: 'error', error, retry }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('This artwork could not be loaded.')).toBeDefined();
    expect(retry).toHaveBeenCalledOnce();
  });
});
