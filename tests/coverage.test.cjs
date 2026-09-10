const test = require("node:test");
const assert = require("node:assert/strict");
const { platformCoverage } = require("../electron/accounts/coverage.cjs");
test("coverage reflects enabled providers without exposing provider internals or enabling planned connections", () => {
  const result = platformCoverage({
    steam: { secret: "not public" },
    epic: {},
    gog: {},
    humble: {},
    ubisoft: {},
  });
  assert.equal(result.length, 12);
  assert.equal(new Set(result.map((item) => item.id)).size, result.length);
  assert.deepEqual(
    result
      .filter((item) => item.canConnect)
      .map((item) => item.id)
      .sort(),
    ["epic", "gog", "humble", "steam", "ubisoft"],
  );
  assert.equal(result.find((item) => item.id === "itch").canConnect, false);
  assert.equal(
    platformCoverage({ itch: {} }).find((item) => item.id === "itch")
      .canConnect,
    true,
  );
  assert.equal(JSON.stringify(result).includes("not public"), false);
});
