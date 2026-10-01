import type { RijksApiError } from '../../api/rijksmuseum';

const HTTP_TOO_MANY_REQUESTS = 429;

export function getErrorMessage(error: RijksApiError): string {
  if (error.kind === 'http' && error.status === HTTP_TOO_MANY_REQUESTS) {
    return 'The service is not available right now. Please try again later.';
  }
  return 'Something went wrong. Please try again.';
}
