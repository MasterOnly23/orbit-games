const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeGames } = require("../electron/library/model.cjs");
const {
  mergeAccountLibrary,
  disconnectAccountLibrary,
} = require("../electron/library/account-library.cjs");
test("personal progress remains independent of installation, account sync and disconnect", () => {
  const game = {
    id: "a".repeat(20),
    name: "A game",
    provider: "Steam",
    providerId: "10",
    playStatus: "completed",
    status: "installed",
    sources: ["manifest"],
  };
  const scanned = mergeGames(
    [{ ...game, playStatus: undefined, status: "uninstalled" }],
    [game],
  );
  assert.equal(scanned[0].status, "uninstalled");
  assert.equal(scanned[0].playStatus, "completed");
  const synced = mergeAccountLibrary(
    scanned,
    { id: "account", provider: "Steam" },
    {
      complete: true,
      games: [{ productId: "10", name: "A game", access: "owned" }],
    },
  );
  assert.equal(synced[0].playStatus, "completed");
  assert.equal(
    disconnectAccountLibrary(synced, "account")[0].playStatus,
    "completed",
  );
  assert.equal(
    mergeGames([{ ...game, playStatus: undefined }], [])[0].playStatus,
    "none",
  );
});
