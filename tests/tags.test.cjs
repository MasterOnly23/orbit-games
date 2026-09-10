const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTags } = require("../electron/library/tags.cjs");
const { mergeGames } = require("../electron/library/model.cjs");
const {
  mergeAccountLibrary,
  disconnectAccountLibrary,
} = require("../electron/library/account-library.cjs");
test("tags normalize whitespace and Unicode, deduplicate case, and can be cleared", () => {
  assert.deepEqual(
    validateTags(["  Con  amigos ", "con amigos", "Accio\u0301n"]),
    ["Con amigos", "Acción"],
  );
  assert.deepEqual(validateTags([]), []);
  for (const value of [
    null,
    "tag",
    [42],
    [""],
    ["a\nb"],
    ["x".repeat(41)],
    Array(21).fill("tag"),
  ])
    assert.throws(() => validateTags(value));
});
test("personal tags survive local detection, account refresh and disconnect", () => {
  const game = {
    id: "a".repeat(20),
    name: "Game",
    provider: "Steam",
    providerId: "10",
    sources: [],
    tags: ["Cooperativo"],
  };
  const scanned = mergeGames(
    [{ ...game, tags: ["provider category"] }],
    [game],
  );
  assert.deepEqual(scanned[0].tags, game.tags);
  const synced = mergeAccountLibrary(
    scanned,
    { id: "account", provider: "Steam" },
    {
      complete: true,
      games: [{ productId: "10", name: "Game", access: "owned" }],
    },
  );
  assert.deepEqual(
    disconnectAccountLibrary(synced, "account")[0].tags,
    game.tags,
  );
});
