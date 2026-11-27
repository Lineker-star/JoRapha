import { describe, expect, it } from 'vitest';

import { isNetworkError } from './syncErrors';

describe('isNetworkError', () => {
  it('treats no-network errors seen on the emulator as offline', () => {
    expect(
      isNetworkError(
        new Error(
          'fetch failed: java.net.UnknownHostException: Unable to resolve host "x.powersync.journeyapps.com"',
        ),
      ),
    ).toBe(true);
    expect(isNetworkError(new Error('Software caused connection abort'))).toBe(true);
    expect(isNetworkError(new Error('Sync stream connection timed out after 30000ms'))).toBe(true);
  });

  it('keeps sign-in and server errors as failures', () => {
    expect(isNetworkError(new Error('[PSYNC_S2103] JWT has expired'))).toBe(false);
    expect(isNetworkError(new Error('sync-ingest HTTP 503'))).toBe(false);
    expect(isNetworkError(new Error('SESSION_INVALID'))).toBe(false);
  });

  it('is false without an error', () => {
    expect(isNetworkError(undefined)).toBe(false);
  });
});
