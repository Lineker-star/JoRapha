// Spike measurement: JS start time, captured as early as possible (imported first by app/_layout).
// Cold start measured here excludes native process start before the JS bundle runs; the report says so.
export const appStartedAt = Date.now();

let coldStartMs: number | null = null;

export function markListVisible(): number {
  if (coldStartMs === null) coldStartMs = Date.now() - appStartedAt;
  return coldStartMs;
}
