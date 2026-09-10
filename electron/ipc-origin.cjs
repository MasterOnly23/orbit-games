const { pathToFileURL } = require("node:url");

function isAppDocument(value, { devUrl, indexPath }) {
  try {
    const actual = new URL(value);
    const expected = new URL(devUrl || pathToFileURL(indexPath).href);
    if (actual.username || actual.password) return false;
    if (devUrl && !["http:", "https:"].includes(expected.protocol))
      return false;
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

function isTrustedAppSender(event, contents, document) {
  return (
    !!contents &&
    !contents.isDestroyed() &&
    event.sender === contents &&
    event.senderFrame === contents.mainFrame &&
    isAppDocument(event.senderFrame?.url || "", document)
  );
}

module.exports = { isAppDocument, isTrustedAppSender };
