const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  createItchProvider,
  authorization,
  fetchLibrary,
  redirectUri,
} = require("../electron/accounts/itch.cjs");
const json = (value) => new Response(JSON.stringify(value));
test("itch OAuth uses fresh PKCE and accepts only its exact callback with one matching state", () => {
  const flow = authorization("orbit-qa-client"),
    second = authorization("orbit-qa-client");
  const url = new URL(flow.provider.sessionUrl),
    state = url.searchParams.get("state");
  assert.equal(url.searchParams.get("scope"), "profile:me profile:owned");
  assert.equal(
    url.searchParams.get("code_challenge"),
    createHash("sha256").update(flow.verifier).digest("base64url"),
  );
  assert.notEqual(flow.verifier, second.verifier);
  const callback = `${redirectUri}?code=synthetic-code&state=${state}`;
  assert.deepEqual(flow.provider.captureAuthorization(callback), {
    code: "synthetic-code",
  });
  for (const invalid of [
    callback.replace("127.0.0.1", "example.com"),
    callback.replace("43817", "43818"),
    callback.replace("/callback", "/other"),
    callback.replace(state, "wrong"),
    `${callback}&code=secondcode`,
    `${callback}&state=${state}`,
  ])
    assert.equal(flow.provider.captureAuthorization(invalid), null);
  assert.equal(createItchProvider(""), null);
});
test("itch owned library paginates, excludes non-games and never retains download keys", async () => {
  const entry = (id, classification = "game") => ({
    id,
    game_id: id,
    owner_id: 42,
    key: "PRIVATE_DOWNLOAD_KEY",
    game: { id, title: `Game ${id}`, classification },
  });
  const fetched = [];
  const result = await fetchLibrary(
    { externalId: "42", accessToken: "PRIVATE_ACCESS_TOKEN" },
    {
      fetchImpl: async (address, options) => {
        const url = new URL(address),
          page = Number(url.searchParams.get("page"));
        fetched.push(page);
        assert.equal(
          options.headers.Authorization,
          "Bearer PRIVATE_ACCESS_TOKEN",
        );
        return json({
          page,
          per_page: 2,
          owned_keys: page === 1 ? [entry(1), entry(2, "tool")] : [],
        });
      },
    },
  );
  assert.deepEqual(fetched, [1, 2]);
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0].productId, "1");
  assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
  await assert.rejects(
    fetchLibrary(
      { externalId: "42" },
      {
        fetchImpl: async () =>
          json({ page: 1, per_page: 1, owned_keys: [entry(1)] }),
      },
    ),
    { code: "incomplete" },
  );
  await assert.rejects(
    fetchLibrary(
      { externalId: "99" },
      {
        fetchImpl: async () =>
          json({ page: 1, per_page: 2, owned_keys: [entry(1)] }),
      },
    ),
    { code: "account-mismatch" },
  );
});
test("itch exchanges and renews tokens in the vault and rejects identity changes and sensitive errors", async () => {
  const provider = createItchProvider("orbit-qa-client");
  let stored,
    userId = 42;
  const grants = [];
  const vault = {
    write: async (_id, value) => {
      stored = value;
    },
    read: async () => stored,
  };
  const fetchImpl = async (address, options) => {
    if (address.endsWith("/oauth/token")) {
      const form = new URLSearchParams(options.body);
      grants.push(form.get("grant_type"));
      if (grants.length === 1) assert.ok(form.get("code_verifier"));
      return json({
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
        expires_in: 3600,
      });
    }
    return json({
      user: { id: userId, username: "qa", email: "PRIVATE_EMAIL" },
    });
  };
  const connected = await provider.connectSession({
    interactive: true,
    id: "qa",
    vault,
    readAuth: async (auth) => {
      const state = new URL(auth.sessionUrl).searchParams.get("state");
      return auth.captureAuthorization(
        `${redirectUri}?code=synthetic-code&state=${state}`,
      );
    },
    fetchImpl,
  });
  assert.equal(connected.externalId, "42");
  assert.ok(!JSON.stringify(stored).includes("PRIVATE_EMAIL"));
  stored.expiresAt = 0;
  await provider.connectSession({
    interactive: false,
    id: "qa",
    vault,
    fetchImpl,
  });
  assert.deepEqual(grants, ["authorization_code", "refresh_token"]);
  const before = structuredClone(stored);
  userId = 99;
  await assert.rejects(
    provider.connectSession({ interactive: false, id: "qa", vault, fetchImpl }),
    { code: "account-mismatch" },
  );
  assert.deepEqual(stored, before);
  await assert.rejects(
    fetchLibrary(connected, {
      fetchImpl: async () =>
        new Response("PRIVATE_ACCESS_TOKEN", { status: 401 }),
    }),
    (error) =>
      error.code === "auth-required" && !error.message.includes("PRIVATE"),
  );
});

test("itch preserves rotated credentials when the subsequent profile request fails", async () => {
  let stored = {
    accessToken: "old-access-token",
    refreshToken: "old-refresh-token",
    externalId: "42",
    expiresAt: 0,
  };
  const provider = createItchProvider("orbit-qa-client");
  const vault = {
    read: async () => stored,
    write: async (_id, value) => {
      stored = value;
    },
  };
  await assert.rejects(
    provider.connectSession({
      interactive: false,
      id: "qa",
      vault,
      fetchImpl: async (address) => {
        if (address.endsWith("/oauth/token"))
          return json({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          });
        throw new Error("offline");
      },
    }),
    { code: "network" },
  );
  assert.equal(stored.refreshToken, "new-refresh-token");
  assert.equal(stored.externalId, "42");
});
