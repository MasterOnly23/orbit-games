# Architecture for workers

Electron main process owns filesystem, native discovery, authentication and persistence. React + Vite + MUI renderer is organized in `src/features/{library,accounts,onboarding,settings}`; App composes navigation/state. Narrow preload IPC bridge; main checks sender and tracks lifecycle. No credentials cross to renderer.

Main is composition, not a home for feature logic. `electron/accounts/register.cjs` wires providers/service/vault; each provider owns protocol details. `auth-window.cjs` creates isolated restricted browser sessions and supports disposable `prepareSession` contexts. `accounts/service.cjs` owns complete snapshot validation, account identity, cancellation and commit orchestration.

`library/scanner.cjs` composes provider detectors; detectors return games/warnings/evidence without persistence. `scan-service.cjs` coordinates cancelable scanning and merge against current user data. `model.cjs` and `account-library.cjs` merge local evidence and account access. Provider identity helpers cannot infer ownership from title alone.

`library/store.cjs` owns JSON persistence/write queue/recovery; `backup.cjs` portable selected-field backups and artwork. Onboarding draft is separate from committed settings and temporary scan results. `library/enrichment.cjs` manages opt-in metadata. Remote providers are external services; no application backend is deployed.

Stable boundaries: keep dependencies explicit, no imports of main from feature modules, no global service locator; preserve IPC/schema when extracting modules. Evolving areas: remaining general IPC handlers, large-library performance, connectors, artwork/cache, distribution. Consult root `ARCHITECTURE.md` for detailed existing module contracts.

Build: Vite dist + electron-builder NSIS x64, own app ID/profile. Current package alpha5 is older than source. New package needs new version/output. Verification: node:test pure modules; Playwright Electron QA with isolated profiles and controlled HTTP. Windows 10, real accounts and installer acceptance require independent evidence.
