const test = require("node:test");
const assert = require("node:assert/strict");
const { createDiagnostics } = require("../electron/library/diagnostics.cjs");
test("diagnostics contain operational aggregates but exclude private values and raw errors", () => {
  const secret = "PRIVATE_DIAGNOSTIC_SENTINEL";
  const result = createDiagnostics(
    {
      version: 1,
      games: [
        {
          id: secret,
          name: secret,
          provider: "Steam",
          status: "installed",
          notes: secret,
          manual: true,
          launch: { target: secret },
          artworkRevision: 1,
          accountEntitlements: [{ accountId: secret }],
          metadata: { hero: secret },
        },
        { name: secret, provider: secret, status: secret },
      ],
      accounts: [
        {
          id: secret,
          externalId: secret,
          displayName: secret,
          providerId: "steam",
          status: "error",
          accessToken: secret,
          error: { code: "auth-required", message: secret },
          lastSuccess: "2026-09-09T10:00:00.000Z",
        },
        {
          providerId: secret,
          status: secret,
          error: { code: secret, message: secret },
          lastSuccess: secret,
        },
      ],
      settings: {
        folders: [secret],
        gameFolders: [secret],
        onlineMetadata: false,
        autoScan: true,
      },
      discovery: { candidates: [{ name: secret, target: secret }] },
      warnings: [secret],
    },
    {
      version: "0.2.0-alpha.3",
      electron: "44.2.0",
      platform: "win32",
      architecture: "x64",
      release: "10.0.26200",
      packaged: true,
    },
  );
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(result.library.byPlatform, { Steam: 1, Other: 1 });
  assert.deepEqual(result.library.byInstallation, {
    installed: 1,
    uninstalled: 0,
    unknown: 1,
  });
  assert.equal(result.configuration.shortcutFolders, 1);
  assert.equal(result.connections[0].errorCode, "auth-required");
  assert.equal(result.connections[1].errorCode, "unknown");
  assert.equal(result.application.packaged, true);
});
test("diagnostics tolerate absent records and only admit known runtime fields", () => {
  const result = createDiagnostics(
    { games: [null], accounts: [null] },
    {
      version: "private",
      release: "private",
      architecture: "private",
      electron: "private",
    },
    "private",
  );
  assert.ok(!JSON.stringify(result).includes("private"));
  assert.equal(result.createdAt, null);
  assert.equal(result.library.total, 0);
  assert.deepEqual(result.connections, []);
});
