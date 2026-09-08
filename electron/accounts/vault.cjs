const fs = require("node:fs/promises");
const path = require("node:path");
const { ProviderError } = require("./provider-error.cjs");

// Inject Electron safeStorage from the main process. No plaintext fallback.
class CredentialVault {
  constructor(directory, safeStorage) {
    this.directory = path.join(directory, "account-credentials");
    this.safeStorage = safeStorage;
    this.queue = Promise.resolve();
  }
  file(id) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)
    )
      throw new ProviderError(
        "invalid-account",
        "Identificador de cuenta no válido.",
      );
    return path.join(this.directory, `${id}.bin`);
  }
  ready() {
    if (!this.safeStorage.isEncryptionAvailable())
      throw new ProviderError(
        "encryption-unavailable",
        "Windows no puede proteger la sesión en este momento. No se guardarán credenciales sin cifrar.",
      );
  }
  async read(id) {
    const file = this.file(id);
    await this.queue.catch(() => {});
    this.ready();
    try {
      if ((await fs.stat(file)).size > 128 * 1024) throw new Error("size");
      const buffer = await fs.readFile(file);
      if (buffer.length > 128 * 1024) throw new Error("size");
      return JSON.parse(this.safeStorage.decryptString(buffer));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new ProviderError(
        "auth-required",
        "No se pudo recuperar la sesión protegida. Vuelve a conectar la cuenta.",
      );
    }
  }
  write(id, credentials) {
    const file = this.file(id);
    this.ready();
    const plaintext = JSON.stringify(credentials);
    if (!plaintext || Buffer.byteLength(plaintext) > 64 * 1024)
      throw new ProviderError(
        "invalid-session",
        "La sesión recibida no tiene un formato válido.",
      );
    const encrypted = this.safeStorage.encryptString(plaintext);
    return this.enqueue(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      const temporary = `${file}.tmp`;
      try {
        await fs.writeFile(temporary, encrypted, { mode: 0o600 });
        await fs.rename(temporary, file);
      } catch {
        await fs.unlink(temporary).catch(() => {});
        throw new ProviderError(
          "storage",
          "No se pudo guardar la sesión protegida. Revisa el espacio y los permisos del perfil.",
        );
      }
    });
  }
  remove(id) {
    const file = this.file(id);
    return this.enqueue(async () => {
      for (const target of [file, `${file}.tmp`]) {
        try {
          await fs.unlink(target);
        } catch (error) {
          if (error.code !== "ENOENT")
            throw new ProviderError(
              "storage",
              "No se pudo eliminar la sesión protegida. Vuelve a intentarlo.",
            );
        }
      }
    });
  }
  enqueue(operation) {
    this.queue = this.queue.catch(() => {}).then(operation);
    return this.queue;
  }
}
module.exports = { CredentialVault };
