// Never return raw messages, response bodies, headers, URLs, prompts or keys.
export function providerDiagnostic(error: unknown): { category: string; httpStatus?: number } {
  const source = typeof error === 'object' && error !== null ? error as Record<string,unknown> : {};
  const status = source.status ?? source.statusCode;
  if (typeof status === 'number' && status >= 100 && status <= 599) {
    return {category: status === 404 ? 'not_found' : status === 429 ? 'rate_limit' : status === 401 || status === 403 ? 'access_denied' : status >= 500 ? 'service_unavailable' : 'request_rejected', httpStatus:status};
  }
  const kind = error instanceof Error ? error.name === 'Error' ? error.constructor.name : error.name : '';
  return {category: ['AbortError','TimeoutError','APIConnectionTimeoutError'].includes(kind) ? 'timeout' : kind === 'SyntaxError' ? 'invalid_response' : kind === 'TypeError' || kind === 'APIConnectionError' ? 'connection_failed' : 'unknown'};
}
export function providerFailureHint(error: unknown): string {
  switch (providerDiagnostic(error).category) {
    case 'not_found': return 'Career board not found; check the saved career URL.';
    case 'rate_limit': return 'Provider request limit reached; try later.';
    case 'access_denied': return 'Provider denied access; check its connection.';
    case 'service_unavailable': return 'Provider is temporarily unavailable; try later.';
    case 'timeout': return 'Provider request timed out; try later.';
    case 'invalid_response': return 'Provider returned an unreadable response.';
    case 'connection_failed': return 'Could not connect to the provider.';
    default: return 'The provider could not complete this request.';
  }
}
