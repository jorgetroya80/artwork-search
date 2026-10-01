import type { FormEvent } from 'react';

import { Button, TextField } from '../../components/ui';

const HINT = 'Use the full name, e.g. "Rembrandt"';

type SearchFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** False while the value is blank, so Search stays disabled. */
  canSubmit: boolean;
  isSearching: boolean;
};

export function SearchForm({
  value,
  onChange,
  onSubmit,
  canSubmit,
  isSearching,
}: SearchFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[1fr_auto]"
    >
      <TextField
        label="Artist name"
        description={HINT}
        type="search"
        name="artist"
        autoComplete="off"
        value={value}
        onValueChange={onChange}
      />
      {/* Row 2 is the TextField input row (subgrid), so the button lines up with the input. */}
      <div className="mt-2 flex flex-col sm:col-start-2 sm:row-start-2 sm:mt-0">
        <Button
          type="submit"
          variant="primary"
          disabled={!canSubmit}
          pending={isSearching}
        >
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
      </div>
    </form>
  );
}
