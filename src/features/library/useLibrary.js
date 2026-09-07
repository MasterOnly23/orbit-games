import { useCallback, useEffect, useState } from "react";
export const statusOf = (game) =>
  game?.statusOverride && game.statusOverride !== "auto"
    ? game.statusOverride
    : game?.status;
export const nameOf = (game) => game?.customName || game?.name || "";
export const statusLabel = {
  installed: "Instalado",
  uninstalled: "No instalado",
  unknown: "Sin verificar",
};
export function useLibrary() {
  const [library, setLibrary] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  useEffect(() => {
    if (!window.orbit) {
      setError("Abre Orbit Games desde su aplicación de Windows.");
      return;
    }
    window.orbit
      .getLibrary()
      .then(setLibrary)
      .catch((e) => setError(e.message));
    return window.orbit.onChange(setLibrary);
  }, []);
  const action = useCallback(async (work, message) => {
    try {
      const value = await work();
      if (message)
        setToast(typeof message === "function" ? message(value) : message);
      return value;
    } catch (e) {
      setError(
        e.message.replace(/^Error invoking remote method '[^']+': Error: /, ""),
      );
      return undefined;
    }
  }, []);
  return { library, error, setError, toast, setToast, action };
}
