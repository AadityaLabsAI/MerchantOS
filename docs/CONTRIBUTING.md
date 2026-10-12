# Contributing to MerchantOS

Thanks for your interest in MerchantOS. This document explains how to set up
a development environment, run the tests, and submit a change.

## Ground rules

1. **One change, one PR.** Don't mix a refactor with a feature.
2. **All tests must pass** before review. The CI runs `npm test` and a build.
3. **No new runtime dependencies** without discussion. The whole point of
   this project is the small surface area.
4. **Money is sacred.** Use the `Money` class. Never floats, never `Number`,
   never `parseInt` for a money field.
5. **No silent defaults.** If you add a new env var, it must be validated
   by `api/src/config/config.ts` (Zod) and default to a safe value.

## Setting up a dev environment

```bash
# Clone
git clone https://github.com/AadityaLabsAI/MerchantOS.git
cd MerchantOS

# Install Node.js 20 (use nvm if you don't have it)
nvm install 20 && nvm use 20

# Install API deps
cd api
npm install
npm run build

# Install web deps
cd ../web
npm install
npm run build
cd ..

# Bring up PostgreSQL (any 15+ instance works)
# Recommended: the system PG service, or docker run -d -p 5432:5432 -e
#   POSTGRES_PASSWORD=postgres postgres:15

# Apply migrations
cd api
DATABASE_URL=postgresql://merchantos:merchantos@127.0.0.1:5432/merchantos node bin/dev/apply-migrations.cjs

# Create your first OWNER user
node bin/create-user.js owner@local 'OwnerPass123!' 'Owner Name'

# Run the API in dev mode
npm run dev
```

The web SPA is served from `web/dist/` by the API at `/app`. If you want
hot-reload for the SPA, run `cd web && npm run watch` in another terminal.

## Running tests

```bash
cd api
npm test
```

15 tests, ~6 seconds. The Node test runner is used (no Jest).

## Code style

- TypeScript strict mode (no `any` unless documented why).
- ESLint with the project config (`npm run lint`).
- Prettier with the project config (the repo includes a `.prettierrc`).
- Imports: relative paths within a module, `@merchantos/*` for cross-module
  shared types.
- File naming: `kebab-case.ts` for files, `PascalCase` for classes, `camelCase`
  for everything else.

## Making a change

1. Branch from `main` (or `phase-1-production-stabilization` for the current
   active branch): `git switch -c feat/<short-name>`
2. Make small, focused commits. The commit message should describe the
   user-visible change, not the implementation.
3. Run the tests: `npm test`
4. Build: `npm run build`
5. Smoke test the API: start it, hit `/healthz`, log in, create a bill.
6. Open a PR. The CI must pass. The PR description should include:
   - What the change does
   - How to test it
   - Any follow-up work

## Areas of the codebase

- `api/src/money/` — the `Money` class. Be very careful here. Every change
  needs a unit test.
- `api/src/auth/` — JWT and AuthGuard. Be even more careful here. Every
  change needs a security test.
- `api/src/billing/` — bill creation, void, money math. The whole point
  of this product.
- `database/migrations/` — one file per change, `IF NOT EXISTS` everywhere.
- `web/src/pages/` — one file per route.
- `docs/` — if your change is user-visible, document it.

## Security

If you find a security issue, **do not file a public issue**. Email
`security@merchantos.example` (replace with the real address before
publishing). See `docs/SECURITY.md` for the threat model.

## Code of conduct

Be kind. Disagree on the merits. Don't make it personal. We're all here
because we want a good merchant operating system to exist.
