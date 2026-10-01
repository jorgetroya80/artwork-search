import type { RijksApiError } from '../../api/rijksmuseum';
import { Button } from '../../components/ui';
import { getErrorMessage } from './getErrorMessage';

type ErrorMessageProps = {
  error: RijksApiError;
  onRetry: () => void;
};

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <p className="text-fg-muted">{getErrorMessage(error)}</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}
