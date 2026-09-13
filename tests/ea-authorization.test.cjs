const test = require("node:test");
const assert = require("node:assert/strict");
const {
  authorizationFromRequest,
  observeEaAuthorization,
} = require("../electron/accounts/ea-authorization.cjs");
const request = (patch = {}) => ({
  webContentsId: 42,
  url: "https://service-aggregation-layer.juno.ea.com/graphql?operationName=fixture",
  requestHeaders: { Authorization: "Bearer SYNTHETIC" },
  ...patch,
});

test("EA authorization accepts only the exact endpoint and owning web contents", () => {
  assert.equal(authorizationFromRequest(request(), 42), "SYNTHETIC");
  for (const patch of [
    { webContentsId: 43 },
    { url: "http://service-aggregation-layer.juno.ea.com/graphql" },
    {
      url: "https://service-aggregation-layer.juno.ea.com.evil.example/graphql",
    },
    { url: "https://service-aggregation-layer.juno.ea.com:8443/graphql" },
    { url: "https://user@service-aggregation-layer.juno.ea.com/graphql" },
    { url: "https://service-aggregation-layer.juno.ea.com/graphql-extra" },
    {
      requestHeaders: {
        Authorization: "Bearer one",
        authorization: "Bearer two",
      },
    },
    { requestHeaders: { Authorization: "Bearer one\r\nheader" } },
    { requestHeaders: { Authorization: ["Bearer one"] } },
    { requestHeaders: { Authorization: "Bearer " + "x".repeat(16385) } },
  ])
    assert.equal(authorizationFromRequest(request(patch), 42), null);
});

test("EA observer releases requests, replaces in-memory authorization and erases it on cancellation", () => {
  let attached,
    removed = 0;
  const webRequest = {
    onBeforeSendHeaders: (filter, listener) => {
      assert.deepEqual(filter.urls, [
        "https://service-aggregation-layer.juno.ea.com/graphql*",
      ]);
      attached = listener;
      if (listener === null) removed++;
    },
  };
  const controller = new AbortController();
  const observer = observeEaAuthorization({
    webRequest,
    webContentsId: 42,
    signal: controller.signal,
  });
  const listener = attached;
  assert.throws(
    () => observeEaAuthorization({ webRequest, webContentsId: 43 }),
    /autenticación EA activa/,
  );
  let callbacks = 0;
  const callback = (result) => {
    assert.deepEqual(result, {});
    callbacks++;
  };
  listener(request(), callback);
  assert.equal(observer.read(), "SYNTHETIC");
  listener(
    request({
      webContentsId: 1,
      requestHeaders: { authorization: "Bearer FOREIGN" },
    }),
    callback,
  );
  assert.equal(observer.read(), "SYNTHETIC");
  listener(
    request({ requestHeaders: { authorization: "Bearer RENEWED" } }),
    callback,
  );
  assert.equal(observer.read(), "RENEWED");
  controller.abort();
  assert.equal(observer.read(), null);
  listener(request(), callback);
  assert.equal(observer.read(), null);
  observer.dispose();
  assert.equal(removed, 1);
  assert.equal(callbacks, 4);
});

test("EA observer does not attach after cancellation", () => {
  const controller = new AbortController();
  controller.abort();
  const observer = observeEaAuthorization({
    webRequest: { onBeforeSendHeaders: () => assert.fail("must not attach") },
    webContentsId: 42,
    signal: controller.signal,
  });
  assert.equal(observer.read(), null);
  observer.dispose();
});
