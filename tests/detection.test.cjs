const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { fileAvailability } = require("../electron/library/availability.cjs");
const { unknownCandidates } = require("../electron/onboarding/discovery.cjs");
const failure = (code) => Object.assign(new Error(code), { code });

test("availability distinguishes missing files, unavailable drives and denied access", async () => {
  const target = path.resolve("fixtures", "game.exe"),
    root = path.parse(target).root;
  assert.equal(
    (await fileAvailability(target, async () => ({ isFile: () => true })))
      .status,
    "installed",
  );
  assert.equal(
    (
      await fileAvailability(target, async () => {
        throw failure("EACCES");
      })
    ).status,
    "unknown",
  );
  assert.equal(
    (
      await fileAvailability(target, async () => {
        throw failure("ENOENT");
      })
    ).status,
    "unknown",
  );
  assert.equal(
    (
      await fileAvailability(target, async (file) => {
        if (file === root) return { isDirectory: () => true };
        throw failure("ENOENT");
      })
    ).status,
    "uninstalled",
  );
});

test("discovery suppresses launcher helpers and known targets without hiding other manually installed games", () => {
  const root = path.resolve("fixtures"),
    installed = path.join(root, "PlatformGame");
  const candidates = [
    "Known.exe",
    "Other.exe",
    "PlatformGame/helper.exe",
    "PlatformGameOther/Game.exe",
  ].map((file) => ({ target: path.resolve(root, file) }));
  const games = [
    { manual: true, installPath: root, targetExecutable: candidates[0].target },
    { installPath: installed },
  ];
  assert.deepEqual(unknownCandidates(candidates, games), [
    candidates[1],
    candidates[3],
  ]);
});
