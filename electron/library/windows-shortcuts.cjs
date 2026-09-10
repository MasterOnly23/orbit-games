const path = require("node:path");
const { game } = require("./detected-game.cjs");
const { normalize, classifyUri } = require("./model.cjs");
async function scanShortcuts({ inventory, steam, epic, riot, io }) {
  const { exists } = io;
  const games = [];
  const steamGames = steam.byAppId,
    missingSteamLibraries = steam.missingLibraries,
    epicGames = epic.byAppName,
    epicDir = epic.manifestDirectory;
  const packages = inventory.packages || [];
  for (const shortcut of inventory.shortcuts) {
    if (!shortcut.target && !shortcut.parsing?.includes("!")) {
      const start = inventory.startApps.find(
        (a) =>
          normalize(a.Name) === normalize(shortcut.name) &&
          a.AppID?.includes("!"),
      );
      if (
        start &&
        packages.some((p) => start.AppID.startsWith(`${p.PackageFamilyName}!`))
      )
        shortcut.parsing = start.AppID;
    }
    if (shortcut.target && !/\.exe$/i.test(shortcut.target)) continue;
    if (/^https?:/i.test(shortcut.parsing || shortcut.url)) continue;
    const uri = shortcut.url;
    const identity = classifyUri(uri);
    let g;
    if (identity) {
      const steam = identity.steamId && steamGames.get(identity.steamId);
      const appName =
        identity.provider === "Epic Games"
          ? decodeURIComponent(uri.split("/apps/")[1]?.split("?")[0] || "")
              .split(":")
              .at(-1)
              .toLowerCase()
          : null;
      const epic = appName && epicGames.get(appName);
      if (steam || epic) {
        (steam || epic).sources.push(shortcut.path);
        continue;
      }
      let status = "unknown",
        reason = "El acceso abre el lanzador; este no confirma la instalación.";
      if (identity.provider === "Steam" && !missingSteamLibraries.length) {
        status = "uninstalled";
        reason =
          "No hay un manifiesto de instalación en las bibliotecas de Steam.";
      }
      if (identity.provider === "Epic Games" && (await exists(epicDir))) {
        status = "uninstalled";
        reason = "No hay un manifiesto de instalación de Epic para este juego.";
      }
      if (identity.provider === "Ubisoft") {
        const install = inventory.ubisoft.find(
          (i) => i.id === identity.providerId,
        );
        if (install && (await exists(install.path))) {
          status = "installed";
          reason =
            "Ubisoft registra la instalación y la carpeta está disponible.";
        }
      }
      g = game(
        shortcut.name,
        identity.provider,
        identity.steamId ? `steam:${identity.steamId}` : uri,
        {
          ...identity,
          status,
          statusReason: reason,
          launch: { kind: "uri", target: uri },
          sources: [shortcut.path],
        },
      );
    } else if (shortcut.parsing?.includes("!") && !shortcut.target) {
      const aumid = shortcut.parsing.replace(/^shell:AppsFolder\\/i, "");
      const p = packages.find(
        (p) => p.PackageFamilyName === aumid.split("!")[0],
      );
      g = game(shortcut.name, "Xbox", aumid, {
        status: p
          ? "installed"
          : inventory.packageScanOk
            ? "uninstalled"
            : "unknown",
        statusReason: p
          ? "Aplicación registrada para tu usuario de Windows."
          : inventory.packageScanOk
            ? "El paquete de este juego no está instalado para tu usuario."
            : "No se pudieron consultar los paquetes de Windows.",
        installPath: p?.InstallLocation,
        launch: { kind: "app", target: aumid },
        sources: [shortcut.path],
      });
    } else {
      const target = shortcut.target;
      const reg = inventory.uninstall.find(
        (r) =>
          (r.InstallLocation &&
            target
              ?.toLowerCase()
              .startsWith(r.InstallLocation.toLowerCase())) ||
          normalize(r.DisplayName) === normalize(shortcut.name),
      );
      const provider = reg?.Publisher?.match(/Electronic Arts/i)
        ? "EA app"
        : /RiotClient/i.test(target)
          ? "Riot Games"
          : /Diablo|Battle\.net|Blizzard/i.test(target)
            ? "Battle.net"
            : /Rockstar/i.test(target)
              ? "Rockstar"
              : /EA Games|Origin Games/i.test(target)
                ? "EA app"
                : "Otros";
      const present = await exists(target);
      const sharedLauncher = /RiotClient|LauncherPatcher|maintenancetool/i.test(
        target,
      );
      g = game(shortcut.name, provider, shortcut.path, {
        status: present
          ? sharedLauncher
            ? "unknown"
            : "installed"
          : "uninstalled",
        statusReason: present
          ? sharedLauncher
            ? "El lanzador existe; la instalación del juego necesita confirmación."
            : "El ejecutable del acceso directo está disponible."
          : "El destino del acceso directo ya no existe.",
        installPath: target ? path.dirname(target) : null,
        launch: { kind: "file", target: shortcut.path },
        targetExecutable: target,
        sources: [shortcut.path],
      });
      if (!target && !shortcut.parsing) {
        g.status = "unknown";
        g.statusReason =
          "Windows no proporcionó el destino de este acceso directo.";
      }
      if (provider === "Riot Games" && shortcut.arguments) {
        const product = shortcut.arguments.match(
          /--launch-product=([\w_]+)/,
        )?.[1];
        const channel = shortcut.arguments.match(
          /--launch-patchline=([\w_]+)/,
        )?.[1];
        if (product && channel) {
          const installation = riot.games.find(
            (game) => game.providerId === `${product}:${channel}`,
          );
          if (installation) {
            g.providerId = installation.providerId;
            g.status = installation.status;
            g.statusReason = installation.statusReason;
            g.installPath = installation.installPath;
            g.targetExecutable = installation.targetExecutable;
          }
        }
      }
      if (/^https?:/i.test(shortcut.parsing || uri)) {
        g.status = "unknown";
        g.statusReason = "Este acceso abre una página web.";
      }
    }
    games.push(g);
  }
  return { games };
}
module.exports = { scanShortcuts };
