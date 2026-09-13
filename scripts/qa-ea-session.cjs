const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const { execFileSync } = require("node:child_process");
(async () => {
  const env = {
    ...process.env,
    ORBIT_SKIP_SCAN: "1",
    ORBIT_DATA_DIR: path.join(
      process.env.APPDATA,
      "Orbit Games Next",
      "qa",
      crypto.randomUUID(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DEV_URL;
  fs.mkdirSync(env.ORBIT_DATA_DIR, { recursive: true });
  const key = path.join(env.ORBIT_DATA_DIR, "fixture-key.pem");
  const cert = path.join(env.ORBIT_DATA_DIR, "fixture-cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=orbit-qa.local",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let graphRequests = 0;
  const server = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
    (request, response) => {
      const url = new URL(request.url, "https://fixture.test");
      response.setHeader("Access-Control-Allow-Origin", "https://www.ea.com");
      response.setHeader("Access-Control-Allow-Headers", "authorization");
      if (request.method === "OPTIONS") {
        response.end();
        return;
      }
      if (url.pathname === "/graphql") {
        if (request.headers.authorization !== "Bearer SYNTHETIC_ONLY") {
          response.writeHead(401);
          response.end();
          return;
        }
        graphRequests++;
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            data: {
              me: {
                id: "ea-fixture",
                ownedGameProducts: { next: null, totalCount: 0, items: [] },
              },
            },
          }),
        );
        return;
      }
      let script = "";
      if (url.pathname === "/login")
        script = "location.href='https://www.ea.com/'";
      if (url.pathname === "/sales/deals")
        script =
          "fetch('https://service-aggregation-layer.juno.ea.com/graphql',{headers:{Authorization:'Bearer SYNTHETIC_ONLY'}}).catch(()=>{})";
      response.setHeader("Content-Type", "text/html");
      response.end(
        `<html><body>EA fixture<script>${script}</script></body></html>`,
      );
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let app;
  try {
    app = await electron.launch({
      executablePath: require("electron"),
      // TLS bypass and DNS mapping belong only to this isolated fixture process.
      args: [
        path.resolve("."),
        "--no-proxy-server",
        "--ignore-certificate-errors",
        `--host-resolver-rules=MAP * 127.0.0.1:${port}`,
      ],
      env,
    });
    const result = await app.evaluate(async () => {
      const { readProviderSession } = process.mainModule.require(
        process.cwd() + "/electron/accounts/auth-window.cjs",
      );
      const { ea } = process.mainModule.require(
        process.cwd() + "/electron/accounts/ea.cjs",
      );
      const partition = "orbit-ea-session-fixture";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const credentials = await readProviderSession({
          partition,
          provider: ea,
          interactive: false,
          signal: controller.signal,
        });
        const library = await ea.fetchLibrary(credentials);
        return {
          identity: credentials.externalId,
          complete: library.complete,
          count: library.games.length,

          containsBearer:
            JSON.stringify(credentials).includes("SYNTHETIC_ONLY"),
        };
      } finally {
        clearTimeout(timer);
      }
    });
    assert.equal(result.identity, "ea-fixture", JSON.stringify(result));
    assert.equal(result.complete, true);
    assert.equal(result.count, 0);
    assert.ok(graphRequests >= 2);
    assert.equal(result.containsBearer, false);
    console.log(
      JSON.stringify({
        success: true,
        controlledElectronTraffic: true,
        ...result,
      }),
    );
  } finally {
    if (app) await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
