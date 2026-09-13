const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { LibraryStore } = require("../electron/library/store.cjs");
const {
  createSetupDrafts,
  draftChoices,
} = require("../electron/onboarding/draft.cjs");
const { registerOnboarding } = require("../electron/onboarding/ipc.cjs");

const choices = () => ({
  folders: [path.resolve("missing-draft-drive", "games")],
  gameFolders: [],
  onlineMetadata: true,
  metadataLanguage: "english",
  metadataCountry: "u",
});

test("setup draft survives restart without applying settings, games or accounts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-draft-"));
  const store = new LibraryStore(directory);
  await store.load();
  const original = structuredClone(store.data);
  const drafts = createSetupDrafts({ store, save: () => store.save() });
  const { session } = await drafts.begin();
  await drafts.write(session, {
    ...choices(),
    previewId: "stale",
    selectedCandidates: ["unreviewed"],
    credentials: "must-not-persist",
  });
  const restarted = new LibraryStore(directory);
  await restarted.load();
  const restored = createSetupDrafts({
    store: restarted,
    save: () => restarted.save(),
  });
  const resumed = await restored.begin();
  assert.deepEqual(resumed.choices, { ...choices(), metadataCountry: "U" });
  assert.notEqual(resumed.session, session);
  for (const key of ["games", "accounts", "settings"])
    assert.deepEqual(restarted.data[key], original[key]);
  assert.equal(restarted.data.onboarding.completedAt, null);
  const serialized = await fs.readFile(store.file, "utf8");
  for (const secret of ["stale", "unreviewed", "must-not-persist", session])
    assert.ok(!serialized.includes(secret));
});

test("draft writes serialize, copy input, recover from save failure and reject stale sessions", async () => {
  const store = { data: { onboarding: { completedAt: "existing" } } };
  let fail = false;
  const drafts = createSetupDrafts({
    store,
    save: async () => {
      if (fail) throw new Error("fixture");
    },
  });
  const first = await drafts.begin();
  const input = choices();
  const pending = drafts.write(first.session, input);
  input.folders.push("bad-mutation");
  await pending;
  const before = structuredClone(store.data);
  fail = true;
  await assert.rejects(
    drafts.write(first.session, { ...choices(), metadataCountry: "AR" }),
    /No se pudo guardar/,
  );
  assert.deepEqual(store.data, before);
  fail = false;
  await Promise.all([
    drafts.write(first.session, { ...choices(), metadataCountry: "ES" }),
    drafts.write(first.session, { ...choices(), metadataCountry: "US" }),
  ]);
  assert.equal(store.data.onboarding.draft.choices.metadataCountry, "US");
  const second = await drafts.begin();
  await assert.rejects(
    drafts.write(first.session, choices()),
    /ya no está activo/,
  );
  fail = true;
  await assert.rejects(drafts.discard(second.session), /No se pudo guardar/);
  assert.ok(store.data.onboarding.draft);
  fail = false;
  await drafts.discard(second.session);
  assert.deepEqual(store.data.onboarding, { completedAt: "existing" });
  await assert.rejects(
    drafts.write(second.session, choices()),
    /ya no está activo/,
  );
});

test("draft validation bounds untrusted input and preserves unsupported versions", async () => {
  for (const folders of [
    ["relative"],
    [path.parse(process.cwd()).root],
    Array(21).fill(path.resolve("games")),
    ["C:\\bad\u0000path"],
  ])
    assert.throws(() => draftChoices({ ...choices(), folders }));
  for (const patch of [
    { metadataLanguage: "invalid" },
    { metadataCountry: "ARG" },
    { onlineMetadata: "true" },
  ])
    assert.throws(() => draftChoices({ ...choices(), ...patch }));
  const store = {
    data: { onboarding: { draft: { version: 99, choices: choices() } } },
  };
  const before = structuredClone(store.data);
  const drafts = createSetupDrafts({
    store,
    save: async () => assert.fail("must not write"),
  });
  await assert.rejects(drafts.begin(), /otra versión/);
  assert.deepEqual(store.data, before);
});

test("completion retains draft on failure, clears it on success and rejects late writes", async () => {
  const handlers = {};
  let fail = false;
  const store = {
    data: {
      games: [],
      settings: { metadataLanguage: "spanish", metadataCountry: "" },
      onboarding: { completedAt: null },
    },
  };
  registerOnboarding({
    handle: (key, callback) => {
      handlers[key] = callback;
    },
    store,
    save: async () => {
      if (fail) throw new Error("fixture");
    },
    snapshot: () => store.data,
    setWatchers: () => {},
    enrich: async () => {},
    report: () => {},
    scanLocal: async () => ({
      games: [],
      warnings: [],
      watchPaths: [],
      scannedAt: "2026-09-13",
    }),
  });
  const { session } = await handlers["setup:draft:begin"]();
  await handlers["setup:draft:write"](session, choices());
  const preview = await handlers["setup:preview"]({
    folders: [],
    gameFolders: [],
  });
  const input = {
    previewId: preview.id,
    selectedCandidates: [],
    onlineMetadata: false,
  };
  fail = true;
  await assert.rejects(handlers["setup:complete"](input), /No se pudo guardar/);
  assert.ok(store.data.onboarding.draft);
  fail = false;
  await handlers["setup:complete"](input);
  assert.ok(store.data.onboarding.completedAt);
  assert.equal(store.data.onboarding.draft, undefined);
  await assert.rejects(
    handlers["setup:draft:write"](session, choices()),
    /ya no está activo/,
  );
});
