import type { FormEvent } from 'react';

import { Button, TextField } from '../../components/ui';

const HINT = 'Use the full name, e.g. "Rembrandt"';

type SearchFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
};

export function SearchForm({
  value,
  onChange,
  onSubmit,
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
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
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
      {/* Offset by the label height so the button lines up with the input. */}
      <div className="flex flex-col sm:mt-7">
        <Button
          type="submit"
          variant="primary"
          disabled={!value.trim()}
          pending={isSearching}
        >
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
      </div>
    </form>
  );
}
