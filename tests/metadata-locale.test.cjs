const test = require("node:test");
const assert = require("node:assert/strict");
const { metadataOptions } = require("../electron/library/metadata-options.cjs");
const {
  getMetadata,
  searchMetadata,
  matchMetadata,
} = require("../electron/library/metadata.cjs");
test("metadata locale rejects query injection and leaves region automatic by default", () => {
  assert.deepEqual(metadataOptions(), {
    metadataLanguage: "spanish",
    metadataCountry: "",
  });
  for (const settings of [
    { metadataLanguage: "english&cc=XX" },
    { metadataCountry: "us" },
    { metadataCountry: "USA" },
    { metadataCountry: 12 },
  ])
    assert.throws(() => metadataOptions(settings));
});
test("metadata requests and cache respect language and country, including manually linked game refresh", async (t) => {
  const calls = [],
    previous = global.fetch;
  t.after(() => {
    global.fetch = previous;
  });
  global.fetch = async (value) => {
    const url = new URL(value);
    calls.push(url);
    const id = url.searchParams.get("appids");
    return {
      ok: true,
      json: async () =>
        id
          ? {
              [id]: {
                data: {
                  name: "Game",
                  short_description: `${url.searchParams.get("l")}:${url.searchParams.get("cc")}`,
                },
              },
            }
          : { items: [{ id: 987601, name: "Game" }] },
    };
  };
  const es = { metadataLanguage: "spanish", metadataCountry: "AR" },
    en = { metadataLanguage: "english", metadataCountry: "US" };
  assert.equal((await getMetadata("987601", es)).description, "spanish:AR");
  assert.equal((await getMetadata("987601", en)).description, "english:US");
  await getMetadata("987601", es);
  assert.equal(calls.length, 2);
  await searchMetadata("Game & Name", en);
  assert.equal(calls.at(-1).searchParams.get("term"), "Game & Name");
  assert.equal(calls.at(-1).searchParams.get("cc"), "US");
  const linked = await matchMetadata(
    { name: "Unrelated custom title", metadata: { steamId: "987601" } },
    en,
  );
  assert.equal(linked.description, "english:US");
  const beforeRefresh = calls.length;
  await matchMetadata(
    { name: "Unrelated custom title", metadata: { steamId: "987601" } },
    en,
    { force: true },
  );
  assert.equal(calls.length, beforeRefresh + 1);
  assert.equal(calls.at(-1).searchParams.get("appids"), "987601");
  await getMetadata("987602");
  assert.equal(calls.at(-1).searchParams.has("cc"), false);
});
