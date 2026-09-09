const test = require("node:test");
const assert = require("node:assert/strict");
const { steam, parseSteamLibrary } = require("../electron/accounts/steam.cjs");
const { createAccountService } = require("../electron/accounts/service.cjs");
const credentials = {
  externalId: "76561198000000000",
  displayName: "Test",
  accessToken: "synthetic-test-session-never-a-real-token",
};
test("Steam accepts empty libraries but rejects partial and duplicated catalog responses", () => {
  assert.deepEqual(parseSteamLibrary({ response: { game_count: 0 } }), {
    complete: true,
    games: [],
  });
  assert.throws(() => parseSteamLibrary({ response: {} }));
  assert.throws(() =>
    parseSteamLibrary({ response: { game_count: 2, games: [{ appid: 10 }] } }),
  );
  assert.throws(() =>
    parseSteamLibrary({
      response: { game_count: 2, games: [{ appid: 10 }, { appid: 10 }] },
    }),
  );
});
test("Steam reports authentication and rate limits without leaking session material", async () => {
  for (const [status, code] of [
    [401, "auth-required"],
    [403, "auth-required"],
    [429, "rate-limit"],
    [500, "unavailable"],
  ]) {
    await assert.rejects(
      steam.fetchLibrary(credentials, {
        fetchImpl: async () => new Response("", { status }),
      }),
      (error) =>
        error.code === code && !error.message.includes(credentials.accessToken),
    );
  }
  await assert.rejects(
    steam.fetchLibrary(credentials, {
      fetchImpl: async () => {
        throw new Error(credentials.accessToken);
      },
    }),
    (error) =>
      error.code === "network" &&
      !error.message.includes(credentials.accessToken),
  );
  const result = await steam.fetchLibrary(credentials, {
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          response: {
            game_count: 1,
            games: [{ appid: 10, name: "Test game" }],
          },
        }),
      ),
  });
  assert.equal(result.games[0].productId, "10");
});
test("accounts persist only metadata, preserve games on failure and clear their own session on disconnect", async () => {
  const store = { data: { games: [], accounts: [] } };
  const cleared = [],
    saved = [];
  let fail = false;
  const provider = {
    ...steam,
    fetchLibrary: async () => {
      if (fail) throw new Error(credentials.accessToken);
      return {
        complete: true,
        games: [{ productId: "10", name: "Test game" }],
      };
    },
  };
  const service = createAccountService({
    store,
    save: async () => saved.push(JSON.stringify(store.data)),
    readSession: async () => credentials,
    clearSession: async (partition) => cleared.push(partition),
    providers: { steam: provider },
  });
  assert.equal((await service.connect("steam")).ok, true);
  const id = store.data.accounts[0].id;
  assert.equal((await service.connect("steam")).error.code, "duplicate");
  assert.equal(store.data.accounts.length, 1);
  const before = JSON.stringify(store.data.games);
  fail = true;
  assert.equal((await service.sync(id)).ok, false);
  assert.equal(JSON.stringify(store.data.games), before);
  assert.ok(saved.every((value) => !value.includes(credentials.accessToken)));
  assert.equal((await service.disconnect(id)).ok, true);
  assert.equal(store.data.accounts.length, 0);
  assert.equal(
    store.data.games[0].accountEntitlements[0].state,
    "disconnected",
  );
  assert.ok(cleared.includes(`persist:orbit-account-${id}`));
  assert.equal((await service.connect("__proto__")).error.code, "unsupported");
});

test("a saved account can be disconnected even when its connector is no longer configured", async () => {
  const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const store = { data: { games: [], accounts: [{ id, providerId: "itch" }] } };
  const cleared = [];
  const service = createAccountService({
    store,
    providers: {},
    save: async () => {},
    readSession: async () => {
      throw new Error("Must not authenticate");
    },
    clearSession: async (_partition, accountId) => cleared.push(accountId),
  });
  assert.equal((await service.sync(id)).ok, false);
  assert.equal((await service.disconnect(id)).ok, true);
  assert.deepEqual(cleared, [id]);
  assert.equal(store.data.accounts.length, 0);
});
