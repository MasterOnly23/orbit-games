const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  isAppDocument,
  isTrustedAppSender,
} = require("../electron/ipc-origin.cjs");

test("development IPC requires the configured protocol, host, port and document path", () => {
  const config = { devUrl: "http://localhost:5173/app" };
  assert.equal(
    isAppDocument("http://localhost:5173/app?language=es#library", config),
    true,
  );
  for (const url of [
    "http://localhost:5173/application",
    "http://localhost:5173/app/other",
    "http://localhost:5173.evil.invalid/app",
    "http://localhost:51730/app",
    "http://localhost:5173@evil.invalid/app",
    "http://user:pass@localhost:5173/app",
    "https://localhost:5173/app",
    "http://127.0.0.1:5173/app",
    "file:///app",
    "about:blank",
    "not a URL",
  ])
    assert.equal(isAppDocument(url, config), false, url);
  assert.equal(isAppDocument("file:///app", { devUrl: "file:///app" }), false);
});

test("packaged IPC accepts only its own file and optional query or fragment", () => {
  const indexPath = path.resolve("dist/index.html"),
    config = { indexPath };
  const url = pathToFileURL(indexPath).href;
  assert.equal(isAppDocument(url, config), true);
  assert.equal(isAppDocument(`${url}?qa=1#library`, config), true);
  assert.equal(isAppDocument(`${url}.other`, config), false);
  assert.equal(
    isAppDocument(pathToFileURL(path.resolve("other/index.html")).href, config),
    false,
  );
  assert.equal(
    isAppDocument("https://example.invalid/index.html", config),
    false,
  );
});

test("even the correct app document cannot invoke IPC from another window or subframe", () => {
  const config = { devUrl: "http://localhost:5173/" };
  const frame = { url: config.devUrl };
  const contents = { mainFrame: frame, isDestroyed: () => false };
  const event = { sender: contents, senderFrame: frame };
  assert.equal(isTrustedAppSender(event, contents, config), true);
  assert.equal(
    isTrustedAppSender({ ...event, sender: {} }, contents, config),
    false,
  );
  assert.equal(
    isTrustedAppSender(
      { ...event, senderFrame: { url: frame.url } },
      contents,
      config,
    ),
    false,
  );
  assert.equal(isTrustedAppSender(event, undefined, config), false);
  contents.isDestroyed = () => true;
  assert.equal(isTrustedAppSender(event, contents, config), false);
});
