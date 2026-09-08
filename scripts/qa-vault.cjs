const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");

(async () => {
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const id = crypto.randomUUID();
  const env = { ...process.env, ORBIT_DATA_DIR: profile, ORBIT_SKIP_SCAN: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DEV_URL;
  const launch = () =>
    electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
  let application;
  try {
    application = await launch();
    await application.firstWindow();
    const result = await application.evaluate(
      async ({ safeStorage }, { profile, id, modulePath }) => {
        const { CredentialVault } = process.mainModule.require(modulePath);
        const vault = new CredentialVault(profile, safeStorage);
        const available = safeStorage.isEncryptionAvailable();
        if (!available) return { available };
        await vault.write(id, {
          accessToken: "ORBIT_SYNTHETIC_QA_TOKEN",
          generation: 1,
        });
        await Promise.all([
          vault.write(id, {
            accessToken: "ORBIT_SYNTHETIC_QA_TOKEN",
            generation: 2,
          }),
          vault.write(id, {
            accessToken: "ORBIT_SYNTHETIC_QA_TOKEN",
            generation: 3,
          }),
        ]);
        return { available, generation: (await vault.read(id)).generation };
      },
      { profile, id, modulePath: path.resolve("electron/accounts/vault.cjs") },
    );
    assert.equal(result.available, true);
    assert.equal(result.generation, 3);
    const file = path.join(profile, "account-credentials", `${id}.bin`);
    assert.ok(
      !(await fs.readFile(file)).includes(
        Buffer.from("ORBIT_SYNTHETIC_QA_TOKEN"),
      ),
    );
    await application.close();
    application = await launch();
    await application.firstWindow();
    const restored = await application.evaluate(
      async ({ safeStorage }, { profile, id, modulePath }) => {
        const { CredentialVault } = process.mainModule.require(modulePath);
        const vault = new CredentialVault(profile, safeStorage);
        const matched = (await vault.read(id))?.generation === 3;
        await vault.remove(id);
        const removed = (await vault.read(id)) === null;
        let invalidRejected = false;
        try {
          vault.file("../../escape");
        } catch {
          invalidRejected = true;
        }
        const unavailableVault = new CredentialVault(profile, {
          isEncryptionAvailable: () => false,
        });
        let plaintextRejected = false;
        try {
          unavailableVault.write(id, { token: "synthetic" });
        } catch {
          plaintextRejected = true;
        }
        return { matched, removed, invalidRejected, plaintextRejected };
      },
      { profile, id, modulePath: path.resolve("electron/accounts/vault.cjs") },
    );
    assert.deepEqual(restored, {
      matched: true,
      removed: true,
      invalidRejected: true,
      plaintextRejected: true,
    });
    console.log(
      JSON.stringify({
        success: true,
        nativeEncryption: true,
        restartPersistence: true,
        ...restored,
      }),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
