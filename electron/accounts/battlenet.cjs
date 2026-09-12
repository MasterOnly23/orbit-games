const { ProviderError } = require("./provider-error.cjs");
const {
  fetchBattleNetCatalog,
  readBattleNetSession,
} = require("./battlenet-catalog.cjs");

const battlenet = {
  id: "battlenet",
  name: "Battle.net",
  implementation: "community",
  version: "1",
  usesBrowserSession: true,
  sessionIdentity: true,
  sessionUrl:
    "https://account.battle.net/oauth2/authorization/account-settings",
  sessionHosts: ["account.battle.net"],
  navigationHosts: [
    "account.battle.net",
    "oauth.battle.net",
    "battle.net",
    "us.battle.net",
    "eu.battle.net",
    "kr.battle.net",
    "tw.battle.net",
  ],
  validSession: (value) => value?.authenticated === true,
  readSession: readBattleNetSession,
  async fetchLibrary(credentials, options) {
    if (!battlenet.validSession(credentials) || !options?.fetchImpl)
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de Battle.net.",
      );
    return fetchBattleNetCatalog(options);
  },
};
module.exports = { battlenet };
