const test = require("node:test");
const assert = require("node:assert/strict");
const { ubisoft } = require("../electron/accounts/ubisoft.cjs");
const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  spaceId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const credentials = {
  externalId: userId,
  displayName: "QA",
  ticket: "synthetic-ticket",
  sessionId: "synthetic-session",
  rememberMeTicket: "synthetic-remember",
};
const entitlement = {
  accessLevel: "Owned",
  type: "Game",
  availability: "Available",
  productId: "123",
  spaceId,
};
test("Ubisoft uses owned entitlements rather than play history and rejects missing game metadata", async () => {
  const catalog = await ubisoft.fetchLibrary(credentials, {
    fetchImpl: async (url) =>
      new Response(
        JSON.stringify(
          url.includes("graphql")
            ? {
                data: {
                  games: [
                    { spaceId, name: "Test game", platform: { type: "PC" } },
                  ],
                },
              }
            : {
                entitlements: [
                  entitlement,
                  {
                    ...entitlement,
                    productId: "expired",
                    availability: "Expired",
                  },
                  {
                    ...entitlement,
                    productId: "subscription",
                    accessLevel: "Subscription",
                  },
                ],
              },
        ),
      ),
  });
  assert.equal(catalog.games.length, 1);
  assert.equal(catalog.games[0].productId, "123");
  assert.equal(catalog.games[0].launch.target, "uplay://launch/123");
  assert.match(catalog.games[0].accessNote, /por verificar/);
  await assert.rejects(
    ubisoft.fetchLibrary(credentials, {
      fetchImpl: async (url) =>
        new Response(
          JSON.stringify(
            url.includes("graphql")
              ? { data: { games: [] } }
              : { entitlements: [entitlement] },
          ),
        ),
    }),
    (error) => error.code === "incomplete",
  );
  await assert.rejects(
    ubisoft.fetchLibrary(credentials, {
      fetchImpl: async () =>
        new Response(JSON.stringify({ entitlements: [], nextCursor: "more" })),
    }),
    (error) => error.code === "incomplete",
  );
});
test("Ubisoft renews tickets and falls back to remember-me only on authentication failure", async () => {
  const requests = [];
  let stored;
  const result = await ubisoft.connectSession({
    interactive: true,
    id: "qa",
    vault: {
      write: async (_id, value) => {
        stored = value;
      },
    },
    readAuth: async () => credentials,
    fetchImpl: async (_url, options) => {
      requests.push(options.method);
      if (options.method === "PUT") return new Response("", { status: 401 });
      assert.equal(options.headers.Authorization, "rm_v1 t=synthetic-remember");
      return new Response(
        JSON.stringify({
          userId,
          ticket: "synthetic-new",
          sessionId: "synthetic-session",
          expiration: "2030-01-01T00:00:00Z",
        }),
      );
    },
  });
  assert.deepEqual(requests, ["PUT", "POST"]);
  assert.equal(stored.ticket, "synthetic-new");
  assert.equal(result.externalId, userId);
  await assert.rejects(
    ubisoft.connectSession({
      interactive: true,
      id: "qa",
      vault: {
        write: async () => assert.fail("No mismatched credential write"),
      },
      readAuth: async () => credentials,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            userId: spaceId,
            ticket: "other",
            sessionId: "other",
          }),
        ),
    }),
    (error) => error.code === "account-mismatch",
  );
});
