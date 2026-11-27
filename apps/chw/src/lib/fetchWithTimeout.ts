// Statuses whose Response must not carry a body (the Response constructor throws otherwise).
const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

/**
 * fetch that fails after timeoutMs, counting the whole exchange: headers AND body. The body is read inside the
 * time limit and handed back as a buffered Response, so a body that stalls after the headers cannot hang the
 * caller (an upload stuck in "syncing" would block every later upload). For JSON API calls only, not streams.
 * `baseFetch` is injectable for tests.
 */
export function fetchWithTimeout(timeoutMs: number, baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const callerSignal = init?.signal ?? null;
    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
    try {
      const response = await baseFetch(input, { ...init, signal: controller.signal });
      const body = NULL_BODY_STATUS.has(response.status) ? null : await response.text();
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  };
}
