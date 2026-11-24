// Pre-commit: scan the staged changes for secrets with Gitleaks (same config as CI).
// Fails closed: if Gitleaks is not installed, the commit is blocked with install instructions.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function findGitleaks() {
  const probe = spawnSync('gitleaks', ['version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (probe.status === 0) return 'gitleaks';

  // winget installs here and only adds it to PATH for shells started after the install.
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const packages = join(local, 'Microsoft', 'WinGet', 'Packages');
    if (existsSync(packages)) {
      for (const dir of readdirSync(packages)) {
        const exe = join(packages, dir, 'gitleaks.exe');
        if (dir.startsWith('Gitleaks.Gitleaks') && existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

const gitleaks = findGitleaks();
if (!gitleaks) {
  console.error(
    '✖ Gitleaks is not installed, so the commit is blocked (secret scanning is mandatory).',
  );
  console.error('  Windows:  winget install --id Gitleaks.Gitleaks --version 8.30.1');
  console.error('  WSL/Linux: see https://github.com/gitleaks/gitleaks#installing (v8.30.1)');
  process.exit(1);
}

const result = spawnSync(
  gitleaks,
  [
    'git',
    '--pre-commit',
    '--staged',
    '--config',
    '.gitleaks.toml',
    '--redact',
    '--no-banner',
    '--verbose',
  ],
  { stdio: 'inherit', shell: gitleaks === 'gitleaks' && process.platform === 'win32' },
);

if (result.status !== 0) {
  console.error(
    '\n✖ Possible secret in the staged changes. Remove it (and rotate it if it was real).',
  );
  process.exit(result.status ?? 1);
}
