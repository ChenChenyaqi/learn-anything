# Contributing to Learn Anything

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must match this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type (required)

| Type       | Usage                                     |
| ---------- | ----------------------------------------- |
| `feat`     | A new feature                             |
| `fix`      | A bug fix                                 |
| `docs`     | Documentation changes (README, comments)  |
| `style`    | Code style (formatting, semicolons, etc.) |
| `refactor` | Code refactoring (no new feature, no fix) |
| `perf`     | Performance improvement                   |
| `test`     | Adding or modifying tests                 |
| `chore`    | Build, dependencies, tooling, etc.        |
| `ci`       | CI/CD configuration changes               |

### Scope (optional)

Add an optional scope in parentheses to indicate the affected area:

- `feat(cli): add --verbose flag`
- `fix(template): correct review workflow`
- `refactor(i18n): extract shared messages`

### Examples

```bash
# ✅ Valid
feat: add CI workflow
feat(cli): add --output flag for custom path
fix: correct session save timing
docs: update README install instructions
refactor: extract adapter registry
chore: bump version to 0.3.0
ci: add GitHub Actions

# ❌ Invalid
update code           # missing type
fix bug               # missing colon and description
WIP                   # non-standard message
feat:add CI           # missing space after colon
```

### Enforcement

commitlint runs automatically on every `git commit`. If the message does not follow the convention, the commit will be rejected.

## Pre-Commit Checks

Every `git commit` triggers these automatic checks:

| Hook         | What it does                           |
| ------------ | -------------------------------------- |
| `pre-commit` | ESLint + Prettier on staged files only |
| `commit-msg` | commitlint format validation           |

You can also run them manually:

```bash
pnpm lint          # ESLint
pnpm format:check  # Prettier check
pnpm format        # Prettier auto-fix
pnpm test          # Run tests
pnpm build         # Compile TypeScript
```

## CI Pipeline

Every push to `main` and every pull request triggers GitHub Actions:

1. **Lint** — ESLint code quality check
2. **Type Check** — TypeScript type checking
3. **Test** — Vitest on Node 20 and 22
4. **Build** — Compile check

All jobs must pass before a PR can be merged.

## Development Workflow

Never push directly to `main` or `develop`. Always use feature/bug/release branches and open Pull Requests. Direct pushes to either branch are blocked by branch protection rules.

### Branches

| Branch                | Purpose                                                                                 | Protection   | Direct Push |
| --------------------- | --------------------------------------------------------------------------------------- | ------------ | ----------- |
| `main`                | Production-ready code. Each commit should be a stable release.                          | ✅ Protected | ❌ PR only  |
| `develop`             | Development integration. Feature and bug branches merge here.                           | ✅ Protected | ❌ PR only  |
| `feature/*` / `fix/*` | Temporary work branches. Force-push allowed.                                            | ❌ None      | ✅          |
| `release/*`           | Release preparation — bump version, update CHANGELOG, final testing.                    | ❌ None      | ✅          |
| `hotfix/*`            | Urgent fixes for production. Branches from `main`, merges to both `main` and `develop`. | ❌ None      | ✅          |
| `sync/*`              | Sync divergence between `main` and `develop` after a release.                           | ❌ None      | ✅          |

### Branch Lifecycle

```
main       ─────●──────────────────●────────────
               /                  /
release       ●────bump──changelog──●
             /                      \
develop  ───●── feature A ──●── feature B ──●──  (continuous integration)
                             \
                              sync back to develop after release
```

### Feature / Bugfix

```bash
# 1. Create a branch from develop
git checkout develop && git pull
git checkout -b feat/my-feature

# 2. Write code and commit (follow Conventional Commits)
git add .
git commit -m "feat: add something"

# 3. Push and open a PR targeting develop
git push -u origin feat/my-feature
gh pr create --base develop --title "feat: add something"
```

All feature and bugfix branches target `develop`. Never target `main` directly unless it's a hotfix or release.

### Release

When `develop` has accumulated enough changes for a release:

```bash
# 1. Create a release branch from develop
git checkout develop && git pull
git checkout -b release/v0.5.0 develop

# 2. Prepare the release
#    - Bump version in package.json
#    - Update CHANGELOG.md
#    - Run final tests
git commit -m "chore: bump version to 0.5.0"

# 3. Push and open a PR targeting main
git push -u origin release/v0.5.0
gh pr create --base main --title "Release v0.5.0"
```

**After the release PR is merged**, sync `main` back to `develop` to keep them aligned:

```bash
# 4. Sync main back to develop
git checkout develop && git pull
git checkout -b sync/main-to-develop-$(date +%Y%m%d) develop
git merge origin/main
# Resolve conflicts if any, then:
git push -u origin sync/main-to-develop-$(date +%Y%m%d)
gh pr create --base develop --title "Sync main → develop after v0.5.0"
```

This step is **required** — skipping it causes `develop` to diverge from `main`, making future releases messy.

### Hotfix

For urgent production fixes that cannot wait for the next release:

```bash
# 1. Create a hotfix branch from main
git checkout main && git pull
git checkout -b hotfix/urgent-fix main

# 2. Fix and commit
git commit -m "fix: resolve critical issue"

# 3. Push and open TWO PRs — one to main, one to develop
git push -u origin hotfix/urgent-fix
gh pr create --base main    --title "hotfix: resolve critical issue"
gh pr create --base develop --title "hotfix: resolve critical issue"
```

Both PRs are necessary: the `main` PR deploys the fix immediately, the `develop` PR ensures the fix is not lost in the next release cycle.

### Quick Reference

| Task          | Branch from            | PR target                |
| ------------- | ---------------------- | ------------------------ |
| New feature   | `develop`              | `develop`                |
| Bug fix       | `develop`              | `develop`                |
| Release       | `develop`              | `main`                   |
| Sync back     | `develop` (merge main) | `develop`                |
| Hotfix        | `main`                 | `main` **and** `develop` |
| Docs / README | `develop`              | `develop`                |
