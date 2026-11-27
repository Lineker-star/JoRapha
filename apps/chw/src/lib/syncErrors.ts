/**
 * True when a sync error only means "no network" (airplane mode, no signal, DNS down, connection dropped or timed
 * out). Being offline is normal for a CHW: the app shows a calm offline notice, not the red "sync is failing" one,
 * which is kept for errors that need attention (sign-in rejected, server errors). Seen on the emulator in airplane
 * mode, 2026-11-27.
 */
const NETWORK_ERROR =
  /UnknownHost|Unable to resolve host|Network request failed|connection abort|Failed to connect|timed out|timeout|ECONNRESET|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|fetch failed|AbortError|The network connection was lost|offline/i;

export function isNetworkError(error: Error | undefined): boolean {
  if (!error) return false;
  return NETWORK_ERROR.test(`${error.name}: ${error.message}`);
}
