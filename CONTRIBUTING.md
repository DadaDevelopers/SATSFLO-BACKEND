# Contributing to SatsFlo Backend

## Branch Naming

```
feat/<short-description>       new feature
fix/<short-description>        bug fix
chore/<short-description>      tooling, deps, config
test/<short-description>       tests only
docs/<short-description>       documentation only
refactor/<short-description>   code change with no behaviour change
```

Examples: `feat/google-auth`, `fix/otp-email-copy`, `test/partner-lifecycle`

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
<type>(<scope>): <short description>

[optional body]
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`

Examples:
```
feat(auth): add Google Sign-In via idToken verification
fix(email): render OTP as single selectable block
test(partner): add full lifecycle integration test
chore(deps): upgrade node-pg-migrate to v8
```

## Workflow

1. Branch off `main`
2. Make changes
3. Run the checklist below before opening a PR
4. Open a PR against `main` — fill in the description template

## Pre-PR Checklist

```bash
npm run lint          # zero ESLint errors
npm run format:check  # zero Prettier violations
npm test              # all tests pass
npm run migrate       # no unapplied migrations left
```

If you added a new endpoint, add at least one integration test covering the happy path and one error case.

## Code Style

- **No comments** unless the *why* is non-obvious (hidden constraint, subtle invariant, known bug workaround)
- No docblocks on functions — names should be self-documenting
- Controllers are thin: validate input, call service, return response
- Services own all business logic and SQL
- All SQL uses parameterised queries (`$1, $2` — never string interpolation)
- Use `ApiResponse` helpers for every response (`ApiResponse.success`, `.error`, `.created`, `.paginated`)

## Adding a Migration

```bash
npm run migrate:create -- --name describe-what-changes
# edit the generated file in src/database/migrations/
npm run migrate        # apply it
```

Always implement both `exports.up` and `exports.down`.

## Adding a New Endpoint

1. Add route in `src/routes/<domain>.routes.js`
2. Add controller method in `src/controllers/<domain>.controller.js`
3. Add business logic in `src/services/<domain>.service.js`
4. Add validators in `src/validators/<domain>.validator.js` if needed
5. Document the endpoint in `API.md`
6. Write an integration test in `tests/integration/<domain>.test.js`

## Environment Variables

Never commit real secrets. The `.env` file is gitignored. Add new variables to `.env.example` with a placeholder value and document them in `docs/DEPLOYMENT.md`.

## Pull Request Template

```
## What
<1-2 sentence summary>

## Why
<motivation or linked issue>

## Test plan
- [ ] npm test passes
- [ ] npm run lint passes
- [ ] Manually tested: <describe what you did>
```

## Review Process

- At least one approval required before merge
- Resolve all review comments before merging
- Squash or rebase before merge — no merge commits
- Delete branch after merge
