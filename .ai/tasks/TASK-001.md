# TASK-001 — Finish EA identity increment

## Objective / why
Finish the uncommitted EA offer-to-content join safely so local shortcuts and account games can share one entry despite localized names. This advances ACC-08; it does not certify real EA support.

## Required context
Read `.ai/AGENT_RULES.md`, `.ai/PROJECT_CONTEXT.md`, relevant identity/account paragraphs in `.ai/ARCHITECTURE.md`, then `git diff`, `electron/library/ea-identity.cjs`, `tests/ea-identity.test.cjs`, `EA_SUPPORT.md`. Inspect direct dependencies as necessary.

## Scope
Existing modified EA files: `electron/accounts/ea.cjs`, `electron/library/{ea-identity,account-library,model}.cjs`, `tests/ea-identity.test.cjs`, `scripts/qa-ea-session.cjs`. Update only `EA_SUPPORT.md` and EA progress/date in `ROADMAP.md` after checks. Report if another file is necessary before editing it.

## Out of scope
No real account login/credentials, installer generation or stable edits. No broad merge refactor, destructive historical duplicate repair, new platform, new dependencies, commit or push. Orchestrator owns `.ai/`.

## Requirements / existing patterns
Use validated offer/content mappings only. Both local-first and account-first imports preserve ID, notes/favorite/tags/artwork and launch evidence. Missing/ambiguous/currently withdrawn mapping must not create a new false join. Existing manual data and unresolved duplicate records must not be destructively repaired. Cancellation or incomplete provider result preserves catalog. Mappings are requested without account bearer using existing bounded transport. Keep unknown installation and ownership states honest.

## Acceptance / verification
Review surrounding integration for regressions and meaningful edge cases, fix focused defects found. Run `npm test` and `node scripts/qa-ea-session.cjs` in Next; baseline immediately before transition: 123 tests passed, HTTPS Electron QA passed before final withdrawn-map filter edit. Fixture uses synthetic loopback traffic, not real EA. Update documents to describe implementation, exact evidence and remaining limits, keeping roadmap count 22/59 unless a full gate actually closes. Date 2026-10-01.

## Worker model / report
Luna Max. Return concise summary, changed files, exact tests and results, unresolved issues and architectural concerns. Do not claim public or real-provider validation.
