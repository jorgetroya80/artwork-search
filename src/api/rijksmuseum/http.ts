import { ENTITY_URL_PREFIX, REQUEST_TIMEOUT_MS, SEARCH_URL } from './constants';
import { RijksApiError } from './errors';

type FetchJsonOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  accept?: string;
};

type RawResponse = { ok: boolean; status: number; body: string };

const ALLOWED_URL_PREFIXES = [ENTITY_URL_PREFIX, `${SEARCH_URL}?`];

export async function fetchJson(
  url: string,
  options: FetchJsonOptions = {}
): Promise<unknown> {
  assertAllowedUrl(url);
  const response = await request(url, options);
  if (!response.ok) throw toHttpError(url, response);
  return parseJson(url, response.body);
}

function assertAllowedUrl(url: string) {
  if (ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) return;
  throw new RijksApiError(`URL is not a Rijksmuseum API URL: ${url}`, {
    kind: 'invalid-id',
    url,
  });
}

async function request(
  url: string,
  {
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
    accept = 'application/json',
  }: FetchJsonOptions
): Promise<RawResponse> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { Accept: accept },
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    };
  } catch (error) {
    // Cancellation by the caller (TanStack Query) is not an API error.
    if (signal?.aborted) throw error;
    const kind = timeout.aborted ? 'timeout' : 'network';
    const reason =
      kind === 'timeout' ? `Timed out after ${timeoutMs} ms` : 'Network error';
    throw new RijksApiError(`${reason}: ${url}`, { kind, url, cause: error });
  }
}

function toHttpError(url: string, { status, body }: RawResponse) {
  const detail = readDetail(body);
  const reason = detail ? `: ${detail}` : '';
  return new RijksApiError(`HTTP ${status}${reason} (${url})`, {
    kind: 'http',
    status,
    url,
  });
}

function readDetail(body: string): string | null {
  try {
    const { detail } = JSON.parse(body) as { detail?: unknown };
    return typeof detail === 'string' ? detail : null;
  } catch {
    return null;
  }
}

function parseJson(url: string, body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new RijksApiError(`Response is not valid JSON: ${url}`, {
      kind: 'parse',
      url,
      cause: error,
    });
  }
}
