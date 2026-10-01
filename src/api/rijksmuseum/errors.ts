export type RijksApiErrorKind =
  'http' | 'network' | 'timeout' | 'parse' | 'invalid-id';

type RijksApiErrorOptions = {
  kind: RijksApiErrorKind;
  url: string;
  status?: number | null;
  cause?: unknown;
};

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

function isRetryable(kind: RijksApiErrorKind, status: number | null) {
  if (kind === 'network' || kind === 'timeout') return true;
  if (kind !== 'http' || status === null) return false;
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR;
}

export class RijksApiError extends Error {
  readonly kind: RijksApiErrorKind;
  readonly status: number | null;
  readonly url: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    { kind, url, status = null, cause }: RijksApiErrorOptions
  ) {
    super(message, { cause });
    this.name = 'RijksApiError';
    this.kind = kind;
    this.status = status;
    this.url = url;
    this.retryable = isRetryable(kind, status);
  }
}
