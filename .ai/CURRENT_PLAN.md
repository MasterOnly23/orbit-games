# Current orchestration board

Full backlog and acceptance gates remain in `ROADMAP.md` (59 tasks). This board contains executable near-term tasks; expand remaining phases as dependencies resolve, without dropping product requirements.

## TASK-001 — Finish EA identity increment
Status: done
Priority: high
Worker: Luna Max
Dependencies: none
Scope: Review existing uncommitted EA offer/content integration, fix focused issues, verify and update evidence. Do not alter real sessions or stable app.
Relevant modules: ea.cjs, ea-identity.cjs, account-library.cjs, model.cjs, EA tests/fixture, EA_SUPPORT.md, ROADMAP.md.
Acceptance criteria: both import orders preserve personal data; absent/ambiguous/withdrawn maps cannot create new false joins; repeated operations stable; current evidence and source/package boundaries documented.
Verification: npm test; node scripts/qa-ea-session.cjs; diff review. Details in tasks/TASK-001.md.

Result (2026-10-01): Luna review fixed unrelated-provider EA enrichment and added its regression. 124/124 tests and loopback Electron QA passed; orchestrator reviewed merge changes, tests and evidence. Root documentation updated; ACC-08 remains open. No real sessions or stable installation touched.

## TASK-002 — Specify next platform integration
Status: pending
Priority: high
Worker: Astra
Dependencies: TASK-001
Scope: Inspect targeted current coverage and primary maintained reference for Xbox/Amazon, choose next viable local connector and write bounded Luna implementation tasks.
Relevant modules: accounts/coverage.cjs, accounts/register.cjs, platform detector contracts, ROADMAP.md.
Acceptance criteria: source-supported authentication/catalog/local identity design, explicit limitations, no speculative support claim or hidden owned-server requirement.
Verification: primary source references and contract review; subsequent implementation tests must cover actual chosen behavior.

Preliminary evidence (2026-10-01): [AmazonGamesLibrary.cs](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/AmazonGamesLibrary/AmazonGamesLibrary.cs) reads GameInstallInfo.sqlite read-only and uses product IDs and amazon-games launch URLs. Amazon is a candidate for the next block; pin the reference and inspect account authentication, catalog and SQLite runtime availability before approving implementation. No real provider files have been inspected.

## TASK-003 — Release validation prerequisites
Status: done
Priority: high
Worker: Astra
Dependencies: none
Scope: Inventory current WINDOWS_VALIDATION.md requirements and available isolated environments; identify exact external inputs for real account and standard-user Win10/Win11 verification.
Relevant modules: WINDOWS_VALIDATION.md, RELEASE_ALPHA5.md, ROADMAP.md.
Acceptance criteria: distinguish available executable checks from missing environments/accounts, keep all public gates open until proven.
Verification: read-only environment evidence; no installation into stable profile.

Result (2026-10-01): read WINDOWS_VALIDATION.md and queried Win32_OperatingSystem: Windows 11 Pro, 10.0.26200, 64 bits. Get-Command found no VBoxManage, vmrun or Get-VM in the current shell. This does not prove that no VM or external machine exists. No Windows 10 test target or real account test session is confirmed. Installation/upgrade/uninstall and same-candidate matrix remain pending; task completion covers prerequisite inventory only, not REL-04/05.
