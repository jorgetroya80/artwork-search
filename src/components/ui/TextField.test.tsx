import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TextField } from './TextField';

describe('TextField', () => {
  it('labels the input and describes it with the description', () => {
    render(
      <TextField
        label="Artist name"
        description="Use the full name"
        value=""
        onValueChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('textbox', {
        name: 'Artist name',
        description: 'Use the full name',
      })
    ).toBeDefined();
  });

  it('renders a searchbox for type search', () => {
    render(
      <TextField
        label="Artist name"
        type="search"
        value=""
        onValueChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('searchbox', { name: 'Artist name' })
    ).toBeDefined();
  });

  it('shows the value and reports typed text', () => {
    const onValueChange = vi.fn();
    render(
      <TextField
        label="Artist name"
        value="Rem"
        onValueChange={onValueChange}
      />
    );
    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Artist name',
    });

    fireEvent.change(input, { target: { value: 'Rembrandt' } });

    expect(input.value).toBe('Rem');
    expect(onValueChange).toHaveBeenCalledWith('Rembrandt');
  });

  it('passes name and autoComplete to the input', () => {
    render(
      <TextField
        label="Artist name"
        name="artist"
        autoComplete="off"
        value=""
        onValueChange={vi.fn()}
      />
    );
    const input = screen.getByRole('textbox', { name: 'Artist name' });

    expect(input.getAttribute('name')).toBe('artist');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });
});
