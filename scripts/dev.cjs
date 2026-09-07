const { spawn } = require("node:child_process");
(async () => {
  const { createServer } = await import("vite");
  const server = await createServer();
  await server.listen();
  const child = spawn(require("electron"), ["."], {
    stdio: "inherit",
    env: {
      ...process.env,
      ORBIT_DEV_URL: server.resolvedUrls.local[0],
      ELECTRON_RUN_AS_NODE: "",
    },
  });
  child.on("exit", () => {
    server.close();
    process.exit();
  });
})();
