# GitHub settings for `Lineker-star/JoRapha`

The exact settings to click so that nothing reaches `main` without a pull request and green CI.
Do sections 1–4 once, right after the first CI run has finished (status checks only appear in the
picker after they have run at least once).

Repository → **Settings** (you need admin rights).

## 1. Ruleset for `main`

Settings → **Rules → Rulesets → New ruleset → New branch ruleset**

| Field              | Value                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Ruleset name       | `main-protection`                                                                                          |
| Enforcement status | **Active**                                                                                                 |
| Bypass list        | Leave **empty**. (Adding yourself lets you skip CI — only do it for a real emergency and remove it after.) |
| Target branches    | **Add target → Include default branch** (`main`)                                                           |

Tick these rules:

- [x] **Restrict deletions**
- [x] **Require linear history** (squash or rebase merges only; keeps `git log` readable)
- [ ] **Require signed commits** — **off for now** (owner decision, 2026-11-25): commits are not signed yet, so it
      would block every merge. Set up signing first (section 5), then turn it on.
- [x] **Require a pull request before merging**
  - Required approvals: **0 while you work alone**, **1** as soon as a second developer joins
    (GitHub never lets an author approve their own PR, so 1 would block every PR you open).
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners — **turn on when a second reviewer exists** (see section 6)
  - [ ] Require approval of the most recent reviewable push — **off while you work alone** (owner decision,
        2026-11-25): it needs someone other than the pusher to approve. Turn it on with code-owner review (section 6).
  - [x] Require conversation resolution before merging
  - Allowed merge methods: **Squash** (and Rebase if you like); untick Merge commits
- [x] **Require status checks to pass**
  - [x] Require branches to be up to date before merging
  - Add these checks exactly (type the name, pick the one from **GitHub Actions**):
    - `Lint, typecheck, unit tests`
    - `Database (migrations + pgTAP)`
    - `Secrets (Gitleaks)`
    - `SAST (Semgrep)`
    - `Dependencies (osv-scanner)`
- [x] **Block force pushes**
- [ ] Require deployments to succeed — not yet (Step 13.2)

Click **Create**.

## 2. Code security

Settings → **Advanced Security** (named "Code security" on some accounts)

| Setting                             | Value                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency graph                    | **Enabled**                                                                                                                              |
| Dependabot alerts                   | **Enabled**                                                                                                                              |
| Dependabot security updates         | **Enabled**                                                                                                                              |
| Grouped security updates            | **Enabled**                                                                                                                              |
| Dependabot version updates          | Enabled automatically by `.github/dependabot.yml`                                                                                        |
| Code scanning → CodeQL analysis     | **Leave "Default setup" OFF** — we use the advanced workflow `.github/workflows/codeql.yml`. With default setup on, that workflow fails. |
| Secret Protection / Secret scanning | **Enabled**                                                                                                                              |
| Push protection                     | **Enabled** — GitHub itself rejects pushes containing known secret formats, before CI even runs                                          |
| Private vulnerability reporting     | **Enabled**                                                                                                                              |

## 3. Actions

Settings → **Actions → General**

| Setting                                                  | Value                                                                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions permissions                                      | **Allow Lineker-star, and select non-Lineker-star, actions and reusable workflows** → tick _Allow actions created by GitHub_, and add: `pnpm/action-setup@*, supabase/setup-cli@*` |
| Require actions to be pinned to a full-length commit SHA | **On** (all ours are pinned)                                                                                                                                                       |
| Fork pull request workflows from outside collaborators   | **Require approval for all external contributors**                                                                                                                                 |
| Workflow permissions                                     | **Read repository contents and packages permissions**                                                                                                                              |
| Allow GitHub Actions to create and approve pull requests | **Off**                                                                                                                                                                            |

## 4. General

Settings → **General**

- Pull Requests: untick **Allow merge commits**; keep **Allow squash merging**; tick
  **Always suggest updating pull request branches** and **Automatically delete head branches**.
- Leave **Allow auto-merge** off until Dependabot updates have proven boring.

## 5. Signed commits (recommended)

Simplest on Windows: sign with an SSH key you already use for GitHub.

```sh
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

Then GitHub → your avatar → **Settings → SSH and GPG keys → New SSH key**, Key type **Signing Key**,
paste the same public key. New commits now show **Verified**. Commits made by Claude Code in this repo
use the same git config; they are signed too as long as the key is usable without a passphrase prompt
(for example loaded in the Windows OpenSSH agent: `ssh-add ~/.ssh/id_ed25519`).

## 6. When a second developer joins

1. Ruleset `main-protection` → Required approvals **1**, tick **Require review from Code Owners** and
   **Require approval of the most recent reviewable push**.
2. Add them to `.github/CODEOWNERS` for the areas they own. Changes to `supabase/migrations/`,
   `supabase/functions/` and `.github/` will then need **your** approval.

## Check that it works

- Open a PR with a TypeScript error → `Lint, typecheck, unit tests` fails → **Merge** is blocked.
- Open a PR that adds a fake AWS key → `Secrets (Gitleaks)` fails (and push protection may reject the push itself).
- Try `git push --force origin main` → rejected.
