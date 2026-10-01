# Orbit Next

Orbit Next is a Windows 10/11 x64 desktop game library being developed toward public/commercial readiness. The full goal includes all viable platform account connectors, strong local discovery, manual games and custom launchers, existing Orbit functionality, onboarding, and release validation. Monetization is deferred.

Work ONLY in `C:/Users/Pipe/Documents/MyGamesProject-next`, branch `feature/orbit-next-onboarding`. Stable checkout `MyGamesProject`, installed Orbit Games and its profile are user production data; leave them untouched. Next uses its own app identity and profile. QA uses random subdirectories of `%APPDATA%/Orbit Games Next/qa`.

`ROADMAP.md` is the public progress checklist; `PRODUCT_PLAN.md` contains requirements and history. `.ai/CURRENT_PLAN.md` is the active worker board, not a replacement or reduction of that goal.

Local-first operation; no owned server by default. Official APIs and maintained community connectors are allowed, with limitations explicit. Do not inspect existing private sessions or credentials. Synthetic tests do not establish real platform support. Real login is performed by the user in the provider window.

Terminology: account entitlement is separate from installation evidence. A shortcut does not prove installation. Personal notes, artwork, tags, favorites and manual launch settings survive scans/sync. Alpha 5 is an existing package; source changes after it are not delivered by that installer.
