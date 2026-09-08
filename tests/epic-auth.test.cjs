const test = require("node:test");
const assert = require("node:assert/strict");
const { epic, captureAuthorization } = require("../electron/accounts/epic.cjs");
const id = "test-account",
  accountId = "a".repeat(32);
const response = (overrides = {}) => ({
  account_id: accountId,
  displayName: "QA",
  access_token: "synthetic-access",
  refresh_token: "synthetic-refresh",
  expires_at: "2030-01-01T00:00:00Z",
  ...overrides,
});

test("Epic exchanges authorization, persists refresh credentials and renews only expired sessions", async () => {
  let stored,
    requests = 0;
  const vault = {
    read: async () => stored,
    write: async (_id, value) => {
      stored = value;
    },
  };
  const fetchImpl = async (_url, options) => {
    requests++;
    const body = new URLSearchParams(options.body);
    assert.equal(
      body.get("grant_type"),
      requests === 1 ? "authorization_code" : "refresh_token",
    );
    return new Response(JSON.stringify(response()));
  };
  const connected = await epic.connectSession({
    interactive: true,
    id,
    vault,
    fetchImpl,
    readAuth: async () => ({ authorizationCode: "c".repeat(32) }),
  });
  assert.equal(connected.externalId, accountId);
  assert.equal(stored.refreshToken, "synthetic-refresh");
  await epic.connectSession({
    interactive: false,
    id,
    vault,
    fetchImpl,
    now: Date.parse("2029-01-01"),
  });
  assert.equal(requests, 1);
  stored.expiresAt = "2020-01-01T00:00:00Z";
  await epic.connectSession({ interactive: false, id, vault, fetchImpl });
  assert.equal(requests, 2);
});
test("Epic rejects changed identity and removes sensitive provider errors from public messages", async () => {
  const stored = {
    externalId: accountId,
    refreshToken: "synthetic-private",
    expiresAt: "2020-01-01",
  };
  const vault = {
    read: async () => stored,
    write: async () => assert.fail("must not replace session"),
  };
  await assert.rejects(
    epic.connectSession({
      id,
      vault,
      interactive: false,
      fetchImpl: async () =>
        new Response(JSON.stringify(response({ account_id: "b".repeat(32) }))),
    }),
    (error) => error.code === "account-mismatch",
  );
  await assert.rejects(
    epic.connectSession({
      id,
      vault,
      interactive: false,
      fetchImpl: async () => {
        throw new Error("synthetic-private");
      },
    }),
    (error) =>
      error.code === "network" && !error.message.includes("synthetic-private"),
  );
  await assert.rejects(
    epic.connectSession({
      id,
      vault,
      interactive: false,
      fetchImpl: async () => new Response("provider secret", { status: 401 }),
    }),
    (error) => error.code === "auth-required",
  );
});
test("Epic authorization capture accepts only its exact local callback and a valid code", () => {
  const code = "a".repeat(32);
  assert.deepEqual(
    captureAuthorization(`http://localhost/launcher/authorized?code=${code}`),
    { authorizationCode: code },
  );
  for (const address of [
    `https://attacker.test/launcher/authorized?code=${code}`,
    `http://localhost:1234/launcher/authorized?code=${code}`,
    `http://localhost/other?code=${code}`,
    "http://localhost/launcher/authorized?code=bad",
  ])
    assert.equal(captureAuthorization(address), null);
});
