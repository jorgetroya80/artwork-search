import type { FormEvent, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

const getButton = () => screen.getByRole('button', { name: 'Go' });

function renderInForm(button: ReactNode) {
  const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <input aria-label="Term" />
      {button}
    </form>
  );
  return onSubmit;
}

describe('Button', () => {
  it('defaults to type button and calls onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);

    fireEvent.click(getButton());

    expect(getButton().getAttribute('type')).toBe('button');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('submits its form when type is submit', () => {
    const onSubmit = renderInForm(<Button type="submit">Go</Button>);

    fireEvent.click(getButton());

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('blocks clicks and focus when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>
    );

    fireEvent.click(getButton());

    expect(onClick).not.toHaveBeenCalled();
    // A natively disabled button is out of the tab order. jsdom does not block .focus() on it.
    expect((getButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks clicks and submit but stays focusable when pending', () => {
    const onClick = vi.fn();
    const onSubmit = renderInForm(
      <Button type="submit" pending onClick={onClick}>
        Go
      </Button>
    );

    getButton().focus();
    fireEvent.click(getButton());

    expect(document.activeElement).toBe(getButton());
    expect((getButton() as HTMLButtonElement).disabled).toBe(false);
    expect(getButton().getAttribute('aria-disabled')).toBe('true');
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps focus when it turns pending', () => {
    const { rerender } = render(<Button>Go</Button>);
    getButton().focus();

    rerender(<Button pending>Go</Button>);

    expect(document.activeElement).toBe(getButton());
  });
});
