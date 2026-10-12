import type { FormEvent } from 'react';

import { Button, TextField } from '../../components/ui';

const HINT = 'Use the full name, e.g. "Rembrandt"';

const ARROW_ICON = (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none">
    <path
      d="M5 12h14M13 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
    />
  </svg>
);

type SearchFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** False while the value is blank, so Search stays disabled. */
  canSubmit: boolean;
  isSearching: boolean;
  /** Smaller form, no numbering or hint, used once results are showing. */
  compact?: boolean;
};

export function SearchForm({
  value,
  onChange,
  onSubmit,
  canSubmit,
  isSearching,
  compact = false,
}: SearchFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="w-full">
      <TextField
        label={compact ? 'Artist name' : '01 — Artist name'}
        description={compact ? undefined : HINT}
        type="search"
        name="artist"
        autoComplete="off"
        value={value}
        onValueChange={onChange}
        inputGroup
        endSlot={
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            pending={isSearching}
            icon={ARROW_ICON}
          >
            <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>
              {isSearching ? 'Searching…' : 'Search'}
            </span>
          </Button>
        }
      />
    </form>
  );
}
