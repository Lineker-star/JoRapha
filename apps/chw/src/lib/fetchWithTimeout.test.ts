import { describe, expect, it } from 'vitest';

import { fetchWithTimeout } from './fetchWithTimeout';

/** A response whose headers arrive at once but whose body never completes until the signal aborts. */
function stalledBodyFetch(): typeof fetch {
  return (_input, init) => {
    const signal = init?.signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"results":'));
        signal?.addEventListener('abort', () => controller.error(new Error('aborted')), {
          once: true,
        });
      },
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  };
}

describe('fetchWithTimeout', () => {
  it('returns a readable response when the server answers in time', async () => {
    const ok: typeof fetch = () => Promise.resolve(new Response('{"a":1}', { status: 200 }));
    const response = await fetchWithTimeout(1_000, ok)('https://example.test');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('fails when the body stalls after the headers (an upload must not hang in "syncing")', async () => {
    await expect(
      fetchWithTimeout(50, stalledBodyFetch())('https://example.test'),
    ).rejects.toThrow();
  });

  it('fails when the server never answers', async () => {
    const never: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      );
    await expect(fetchWithTimeout(50, never)('https://example.test')).rejects.toThrow();
  });

  it('passes a 204 through without a body', async () => {
    const noContent: typeof fetch = () => Promise.resolve(new Response(null, { status: 204 }));
    const response = await fetchWithTimeout(1_000, noContent)('https://example.test');
    expect(response.status).toBe(204);
  });

  it("aborts when the caller's own signal aborts", async () => {
    const caller = new AbortController();
    const never: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      );
    const pending = fetchWithTimeout(10_000, never)('https://example.test', {
      signal: caller.signal,
    });
    caller.abort();
    await expect(pending).rejects.toThrow();
  });
});
