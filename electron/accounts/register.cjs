const { safeStorage } = require("electron");
const { createAccountService } = require("./service.cjs");
const {
  readProviderSession,
  clearProviderSession,
} = require("./auth-window.cjs");
const { CredentialVault } = require("./vault.cjs");
const { createItchProvider } = require("./itch.cjs");
const { steam } = require("./steam.cjs");
const { gog } = require("./gog.cjs");
const { epic } = require("./epic.cjs");
const { humble } = require("./humble.cjs");
const { ubisoft } = require("./ubisoft.cjs");
const { platformCoverage } = require("./coverage.cjs");

function registerAccounts({ store, save, win, handle, itchClientId }) {
  const vault = new CredentialVault(store.directory, safeStorage);
  const itch = createItchProvider(itchClientId);
  const providers = {
    steam,
    gog,
    epic,
    humble,
    ubisoft,
    ...(itch ? { itch } : {}),
  };
  const accounts = createAccountService({
    store,
    save,
    readSession: (options) =>
      options.provider.connectSession
        ? options.provider.connectSession({
            ...options,
            vault,
            readAuth: (provider = options.provider) =>
              readProviderSession({ ...options, provider, parent: win }),
          })
        : readProviderSession({ ...options, parent: win }),
    clearSession: async (partition, id) => {
      await clearProviderSession(partition);
      await vault.remove(id);
    },
    providers,
  });
  handle("accounts:providers", () =>
    Object.values(providers).map((provider) => ({
      id: provider.id,
      name: provider.name === "Ubisoft" ? "Ubisoft Connect" : provider.name,
    })),
  );
  handle("accounts:connect", (provider) => accounts.connect(provider));
  handle("accounts:coverage", () => platformCoverage(providers));
  handle("accounts:cancel", () => accounts.cancel());
  handle("accounts:sync", (id) => accounts.sync(id));
  handle("accounts:disconnect", (id) => accounts.disconnect(id));

  return accounts;
}
module.exports = { registerAccounts };
