const test = require("node:test");
const assert = require("node:assert/strict");
const { gog } = require("../electron/accounts/gog.cjs");
const credentials = { externalId: "123", displayName: "Test Account" };
const pageData = (page, id) => ({
  page,
  pages: 2,
  total: 2,
  _embedded: { items: [{ game: { id, title: `Game ${id}` } }] },
});
test("GOG identity excludes tokens and its catalog follows all pages using the isolated session", async () => {
  const identity = await gog.readSession({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          isLoggedIn: true,
          userId: "123",
          username: "Test Account",
          accessToken: "synthetic-not-a-real-token",
        }),
      ),
  });
  assert.deepEqual(identity, credentials);
  const urls = [];
  const library = await gog.fetchLibrary(credentials, {
    fetchImpl: async (url, options) => {
      assert.equal(options.credentials, "include");
      urls.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      return new Response(JSON.stringify(pageData(page, String(page))));
    },
  });
  assert.equal(library.complete, true);
  assert.equal(library.games.length, 2);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes("Test%20Account"));
});
test("GOG rejects changed pagination, duplicate products, missing pages and login failures", async () => {
  for (const payload of [
    pageData(1, "1"),
    { ...pageData(2, "2"), total: 3 },
    { ...pageData(2, "2"), _embedded: { items: [] } },
  ]) {
    let calls = 0;
    await assert.rejects(
      gog.fetchLibrary(credentials, {
        fetchImpl: async () =>
          new Response(
            JSON.stringify(++calls === 1 ? pageData(1, "1") : payload),
          ),
      }),
    );
  }
  await assert.rejects(
    gog.fetchLibrary(credentials, {
      fetchImpl: async () => new Response("", { status: 401 }),
    }),
    (error) => error.code === "auth-required",
  );
});
