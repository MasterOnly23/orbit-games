const titles = require("./battlenet-title-ids.json");

function battleNetTitleId(entry) {
  const command = entry.UninstallString;
  if (
    typeof command !== "string" ||
    command.length > 4096 ||
    !/(?:^|[\\/])Battle\.net(?: Launcher)?\.exe"?\s/i.test(command) ||
    /\b(?:beta|ptr|test|preview)\b/i.test(entry.DisplayName || "")
  )
    return undefined;
  const matches = [
    ...command.matchAll(
      /(?:^|\s)--uid=(?:"([a-z0-9_]+)"|([a-z0-9_]+))(?=\s|$)/gi,
    ),
  ];
  if (matches.length !== 1) return undefined;
  const uid = (matches[0][1] || matches[0][2]).toLowerCase();
  return Object.hasOwn(titles, uid) ? titles[uid] : undefined;
}
function sameBattleNetProduct(a, b) {
  return (
    a.provider === "Battle.net" &&
    b.provider === "Battle.net" &&
    !a.manual &&
    !b.manual &&
    !!a.providerId &&
    a.providerId === b.providerId
  );
}
module.exports = { battleNetTitleId, sameBattleNetProduct };
