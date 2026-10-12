import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Layout } from './Layout';

describe('Layout', () => {
  it('has the wordmark, one main landmark and the footer link', () => {
    render(
      <Layout>
        <p>content</p>
      </Layout>
    );

    expect(screen.getAllByText('Artwork Search')).toHaveLength(2);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(
      screen
        .getByRole('link', {
          name: 'Collection data and images: Rijksmuseum',
        })
        .getAttribute('href')
    ).toBe('https://data.rijksmuseum.nl');
  });

  it('renders children inside the main landmark', () => {
    render(
      <Layout>
        <p>content</p>
      </Layout>
    );

    expect(screen.getByRole('main').contains(screen.getByText('content'))).toBe(
      true
    );
  });

  it('renders an optional toolbar slot', () => {
    render(
      <Layout toolbar={<p>toolbar content</p>}>
        <p>content</p>
      </Layout>
    );

    expect(screen.getByText('toolbar content')).toBeDefined();
  });
});
