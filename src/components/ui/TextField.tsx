import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';

export type TextFieldProps = {
  label: string;
  /** Help text linked to the input as its accessible description. */
  description?: string;
  value: string;
  onValueChange: (value: string) => void;
  type?: 'text' | 'search';
  name?: string;
  autoComplete?: string;
};

export function TextField({
  label,
  description,
  value,
  onValueChange,
  type = 'text',
  name,
  autoComplete,
}: TextFieldProps) {
  return (
    <Field.Root className="flex w-full flex-col gap-1">
      <Field.Label className="font-medium">{label}</Field.Label>
      <Input
        type={type}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue)}
        className="min-h-11 w-full rounded-control border border-border bg-bg px-3 text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {description && (
        <Field.Description className="text-sm text-fg-muted">
          {description}
        </Field.Description>
      )}
    </Field.Root>
  );
}
