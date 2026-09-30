/** Longest a request may take before the UI gives up and shows an error. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** A request that got no response in time (distinct from a caller's abort). */
export class RequestTimeoutError extends Error {
  constructor() {
    super('The server took too long to respond. Please try again.');
    this.name = 'TimeoutError';
  }
}

/**
 * fetch() with a timeout. The caller's own AbortSignal still works (its
 * abort surfaces as the usual AbortError); running out of time surfaces as
 * RequestTimeoutError so it can be reported instead of silently ignored.
 */
export async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const outer = init.signal;
  const forwardAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', forwardAbort, { once: true });
  }
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  // The session is an HttpOnly cookie (also cross-site, API on another
  // host), and state-changing requests carry the header the server's CSRF
  // check requires.
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (!['GET', 'HEAD'].includes(method)) headers.set('X-Requested-With', 'XMLHttpRequest');
  try {
    return await fetch(input, { ...init, headers, credentials: 'include', signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new RequestTimeoutError();
    throw err;
  } finally {
    window.clearTimeout(timer);
    outer?.removeEventListener('abort', forwardAbort);
  }
}
