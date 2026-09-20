const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseEaOffers,
  readEaOfferMapping,
} = require("../electron/accounts/ea-offers.cjs");
const response = (items) => ({ data: { legacyOffers: items } });

test("EA mapping requires the requested offers and drops executable and registry directives", () => {
  const result = parseEaOffers(
    response([
      {
        offerId: "offer1",
        contentId: "content1",
        executePathOverride: "PRIVATE_PATH",
        executeParameters: "PRIVATE_ARGS",
      },
    ]),
    ["offer1"],
  );
  assert.deepEqual(result, [{ offerId: "offer1", contentId: "content1" }]);
  for (const payload of [
    response([]),
    response([{ offerId: "other", contentId: "a" }]),
    response([{ offerId: "offer1", contentId: "../file" }]),
    {
      ...response([{ offerId: "offer1", contentId: "a" }]),
      errors: [{ message: "PRIVATE" }],
    },
  ])
    assert.throws(
      () => parseEaOffers(payload, ["offer1"]),
      (error) =>
        error.code === "incomplete" && !error.message.includes("PRIVATE"),
    );
});

test("EA mapping excludes ambiguous content across batches and does not infer missing content IDs", async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `offer${index}`);
  const calls = [];
  const mapping = await readEaOfferMapping(ids, async (batch) => {
    calls.push(batch.length);
    return response(
      batch.map((offerId) => ({
        offerId,
        contentId: ["offer0", "offer100"].includes(offerId)
          ? "shared"
          : offerId === "offer1"
            ? null
            : `content${offerId}`,
      })),
    );
  });
  assert.deepEqual(calls, [100, 1]);
  assert.equal(mapping.length, 98);
  assert.ok(
    !mapping.some(
      (item) => item.contentId === "shared" || item.offerId === "offer1",
    ),
  );
  assert.deepEqual(
    await readEaOfferMapping([], () => assert.fail("no network needed")),
    [],
  );
});

test("EA mapping rejects incomplete later batches and cancels pending requests without returning partial mappings", async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `offer${index}`);
  await assert.rejects(
    readEaOfferMapping(ids, async (batch) =>
      response(
        batch.length === 1
          ? []
          : batch.map((offerId) => ({ offerId, contentId: offerId })),
      ),
    ),
    { code: "incomplete" },
  );
  const controller = new AbortController();
  const pending = readEaOfferMapping(["offer"], () => new Promise(() => {}), {
    signal: controller.signal,
  });
  controller.abort(new Error("cancelled fixture"));
  await assert.rejects(pending, /cancelled fixture/);
});
