const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
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
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [path.resolve(".")],
    env,
  });
  try {
    const results = await app.evaluate(async ({ session, BrowserWindow }) => {
      const { readProviderSession } = process.mainModule.require(
        process.cwd() + "/electron/accounts/auth-window.cjs",
      );
      const results = [];
      for (const cancelled of [false, true]) {
        const partition = `orbit-auth-qa-${cancelled}`;
        const isolated = session.fromPartition(partition);
        await isolated.protocol.handle(
          "https",
          () =>
            new Response("<html>Fixture</html>", {
              headers: { "Content-Type": "text/html" },
            }),
        );
        let disposed = 0,
          aborted = 0,
          prefs;
        const provider = {
          name: "Fixture",
          sessionUrl: "https://fixture.test/",
          sessionHosts: ["fixture.test"],
          navigationHosts: ["fixture.test"],
          validSession: (value) => value?.externalId === "fixture",
          prepareSession: ({ webContents, signal }) => {
            prefs = webContents.getLastWebPreferences();
            signal.addEventListener("abort", () => {
              aborted++;
            });
            return {
              dispose: () => {
                disposed++;
              },
              readSession: async () => {
                if (!cancelled) return { externalId: "fixture" };
                setTimeout(
                  () => BrowserWindow.fromWebContents(webContents)?.close(),
                  20,
                );
                return new Promise((resolve) =>
                  signal.addEventListener("abort", () => resolve(null), {
                    once: true,
                  }),
                );
              },
            };
          },
        };
        let outcome;
        try {
          outcome = (
            await readProviderSession({
              partition,
              provider,
              interactive: false,
            })
          ).externalId;
        } catch (error) {
          outcome = error.code;
        }
        results.push({
          outcome,
          disposed,
          aborted,
          node: prefs.nodeIntegration,
          preload: !!prefs.preload,
        });
        isolated.protocol.unhandle("https");
      }
      return results;
    });
    assert.deepEqual(results, [
      {
        outcome: "fixture",
        disposed: 1,
        aborted: 1,
        node: false,
        preload: false,
      },
      {
        outcome: "cancelled",
        disposed: 1,
        aborted: 1,
        node: false,
        preload: false,
      },
    ]);
    console.log(JSON.stringify({ success: true, windowLifecycle: results }));
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
