// Spike measurement: JS start time, captured as early as possible (imported first by app/_layout).
// Cold start measured here excludes native process start before the JS bundle runs; the report says so.
export const appStartedAt = Date.now();

let coldStartMs: number | null = null;
let measured = false;
let signInShown = false;

// The sign-in screen waits for a person, so a run that showed it is not a cold-start measurement.
export function markSignInShown(): void {
  signInShown = true;
}

/** Start-up timing mark in the log (spike diagnostics; no data). */
export function markStartup(step: string): void {
  console.warn(`[startup] ${step} +${Date.now() - appStartedAt} ms`);
}

// Start-up to list for a launch with an existing session; null when this run went through sign-in.
export function markListVisible(): number | null {
  if (!measured) {
    measured = true;
    coldStartMs = signInShown ? null : Date.now() - appStartedAt;
    markStartup('list visible');
  }
  return coldStartMs;
}
