// Regenerates packages/db-types/src/database.types.ts with the Supabase CLI.
//
//   pnpm db:types                         from the local stack (needs Docker + `pnpm supabase start`)
//   SUPABASE_PROJECT_REF=<ref> pnpm db:types   from a hosted project, no Docker (needs `pnpm supabase login`)
//
// Writes the file only when the CLI succeeds, so a failed run never wipes the existing types.
// No shell redirection, so it behaves the same in PowerShell and WSL.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep in sync with supabase/migrations: public + the 13 domain schemas.
const SCHEMAS = [
  'public',
  'identity',
  'patient',
  'provider',
  'scheduling',
  'clinical',
  'referral',
  'lab',
  'pharmacy',
  'community',
  'billing',
  'content',
  'audit',
  'sync',
];

const target = fileURLToPath(new URL('../src/database.types.ts', import.meta.url));
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const source = projectRef ? ['--project-id', projectRef] : ['--local'];
const args = ['gen', 'types', 'typescript', ...source, '--schema', SCHEMAS.join(',')];

// Run the CLI's JS entry point with this Node binary: no shell, same on Windows, WSL and CI.
const require = createRequire(import.meta.url);
const cliPackage = require.resolve('supabase/package.json');
const cli = join(dirname(cliPackage), require(cliPackage).bin.supabase);

const result = spawnSync(process.execPath, [cli, ...args], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

if (result.status !== 0 || !result.stdout?.includes('export type Database')) {
  console.error('db:types failed — src/database.types.ts left unchanged.');
  console.error(result.stderr || result.error?.message || 'No type output received.');
  console.error(
    projectRef
      ? 'Are you logged in? Run `pnpm supabase login` once, then retry.'
      : 'Is the local stack running? Start Docker, then `pnpm supabase start` (see supabase/README.md).',
  );
  process.exit(1);
}

writeFileSync(target, result.stdout);
console.log(`Wrote ${target} from ${projectRef ? `project ${projectRef}` : 'the local stack'}.`);
