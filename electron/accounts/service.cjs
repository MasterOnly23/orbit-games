const { randomUUID } = require("node:crypto");
const {
  mergeAccountLibrary,
  disconnectAccountLibrary,
} = require("../library/account-library.cjs");
const { ProviderError, publicError } = require("./provider-error.cjs");

// Session identifiers are generated here, never accepted from the renderer.
const partitionFor = (id) => {
  if (!/^[a-f0-9-]{36}$/.test(id))
    throw new ProviderError("invalid-account", "Cuenta no válida.");
  return `persist:orbit-account-${id}`;
};
function createAccountService({
  store,
  save,
  readSession,
  clearSession,
  providers,
}) {
  let busy = false;
  const run = async (operation) => {
    if (busy)
      return {
        ok: false,
        error: {
          code: "busy",
          message:
            "Termina la conexión o sincronización actual antes de continuar.",
        },
      };
    busy = true;
    try {
      return { ok: true, ...(await operation()) };
    } catch (error) {
      return { ok: false, error: publicError(error) };
    } finally {
      busy = false;
    }
  };
  const find = (id) => {
    const account = store.data.accounts.find((a) => a.id === id);
    if (!account || !providers[account.providerId])
      throw new ProviderError(
        "invalid-account",
        "La cuenta ya no está disponible.",
      );
    return account;
  };
  return {
    connect: (providerId) =>
      run(async () => {
        const provider =
          Object.hasOwn(providers, providerId) && providers[providerId];
        if (!provider)
          throw new ProviderError(
            "unsupported",
            "Esta plataforma todavía no tiene un conector disponible.",
          );
        const id = randomUUID();
        let retained = false;
        try {
          const credentials = await readSession({
            id,
            partition: partitionFor(id),
            provider,
            interactive: true,
          });
          if (
            store.data.accounts.some(
              (a) =>
                a.providerId === providerId &&
                a.externalId === credentials.externalId,
            )
          )
            throw new ProviderError(
              "duplicate",
              "Esta cuenta ya está agregada. Usa Sincronizar o desconéctala antes de volver a conectarla.",
            );
          const catalog = await provider.fetchLibrary(credentials, {
            fetchImpl: credentials.fetchImpl,
          });
          const account = {
            id,
            providerId,
            provider: provider.name,
            externalId: credentials.externalId,
            displayName: String(
              credentials.displayName || credentials.externalId,
            ).slice(0, 200),
            status: "connected",
            lastSuccess: new Date().toISOString(),
          };
          const games = mergeAccountLibrary(store.data.games, account, catalog);
          store.data.games = games;
          store.data.accounts.push(account);
          // Keep the session if disk persistence fails: retry must not leave an in-memory account without its session.
          retained = true;
          await save();
          return { count: catalog.games.length };
        } finally {
          if (!retained)
            await clearSession(partitionFor(id), id).catch(() => {});
        }
      }),
    sync: (id) =>
      run(async () => {
        const account = find(id),
          provider = providers[account.providerId];
        try {
          const credentials = await readSession({
            id,
            partition: partitionFor(id),
            provider,
            interactive: false,
          });
          if (credentials.externalId !== account.externalId)
            throw new ProviderError(
              "account-mismatch",
              "La sesión corresponde a otra cuenta. Desconéctala y vuelve a conectarla.",
            );
          const catalog = await provider.fetchLibrary(credentials, {
            fetchImpl: credentials.fetchImpl,
          });
          store.data.games = mergeAccountLibrary(
            store.data.games,
            account,
            catalog,
          );
          account.status = "connected";
          account.lastSuccess = new Date().toISOString();
          delete account.error;
          await save();
          return { count: catalog.games.length };
        } catch (error) {
          account.status = "error";
          account.error = publicError(error);
          await save();
          throw error;
        }
      }),
    disconnect: (id) =>
      run(async () => {
        find(id);
        await clearSession(partitionFor(id), id);
        store.data.accounts = store.data.accounts.filter((a) => a.id !== id);
        store.data.games = disconnectAccountLibrary(store.data.games, id);
        await save();
      }),
  };
}
module.exports = { createAccountService, partitionFor };
