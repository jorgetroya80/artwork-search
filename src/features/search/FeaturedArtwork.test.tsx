import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../test/msw/server';
import { renderWithClient } from '../../test/render';
import {
  FEATURED_ARTWORK_ID,
  FEATURED_IMAGE_WIDTH,
  FeaturedArtwork,
} from './FeaturedArtwork';

describe('FeaturedArtwork', () => {
  it('shows the Night Watch image and caption', async () => {
    renderWithClient(<FeaturedArtwork />);

    const image = await screen.findByRole<HTMLImageElement>('img');
    expect(image.alt).toContain('The Night Watch');
    expect(image.src).toContain(`/full/${FEATURED_IMAGE_WIDTH},/`);
    expect(screen.getByText(/The Night Watch/)).toBeDefined();
    expect(screen.getByText('1642')).toBeDefined();
  });

  it('shows an empty box, with no alert, when the artwork request fails', async () => {
    server.use(
      http.get(
        FEATURED_ARTWORK_ID,
        () => new HttpResponse(null, { status: 500 })
      )
    );

    const { container } = renderWithClient(<FeaturedArtwork />);

    await waitFor(() => {
      expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
