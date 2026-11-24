// Regenerates src/database.types.ts from the local Supabase database (`supabase start` must be running).
// Writes the file only when the CLI succeeds, so a failed run never wipes the existing types.
// Works the same in PowerShell and WSL (no shell redirection).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../src/database.types.ts', import.meta.url));
const args = ['gen', 'types', 'typescript', '--schema', 'public']; // targets the local stack by default

const result = spawnSync('supabase', args, {
  encoding: 'utf8',
  shell: process.platform === 'win32', // resolves supabase.cmd from node_modules/.bin on Windows
  maxBuffer: 64 * 1024 * 1024,
});

if (result.status !== 0 || !result.stdout?.includes('export type Database')) {
  console.error('db:types failed — src/database.types.ts left unchanged.');
  console.error(result.stderr || result.error?.message || 'No type output received.');
  console.error(
    'Is the local Supabase stack running? It is set up in Step 0.2 (`supabase start`).',
  );
  process.exit(1);
}

writeFileSync(target, result.stdout);
console.log(`Wrote ${target}`);
