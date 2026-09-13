import { useEffect, useRef, useState } from "react";

const initialChoices = (settings) => ({
  folders: settings.folders || [],
  gameFolders: settings.gameFolders || [],
  onlineMetadata: !!settings.onlineMetadata,
  metadataLanguage: settings.metadataLanguage || "spanish",
  metadataCountry: settings.metadataCountry || "",
});

export default function useSetupDraft(settings) {
  const defaults = useRef(initialChoices(settings));
  const current = useRef(defaults.current);
  const session = useRef(null);
  const pending = useRef(Promise.resolve());
  const generation = useRef(0);
  const [choices, setChoices] = useState(current.current);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Cargando borrador…");
  const [error, setError] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    window.orbit
      .beginSetupDraft()
      .then((result) => {
        if (!active) return;
        session.current = result.session;
        pending.current = Promise.resolve();
        current.current = result.choices || defaults.current;
        setChoices(current.current);
        setRecovered(!!result.choices);
        setReady(true);
        setError("");
        setStatus(
          result.choices
            ? "Borrador recuperado"
            : "Las elecciones se guardarán en este PC.",
        );
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function persist(value) {
    const revision = ++generation.current;
    setStatus("Guardando borrador…");
    setError("");
    const task = window.orbit.saveSetupDraft(session.current, value);
    pending.current = task;
    task.then(
      () => {
        if (revision === generation.current)
          setStatus("Borrador guardado en este PC");
      },
      (failure) => {
        if (revision === generation.current) {
          setStatus("Borrador sin guardar");
          setError(
            failure.message.replace(
              /^Error invoking remote method '[^']+': Error: /,
              "",
            ),
          );
        }
      },
    );
    return task;
  }
  function setField(key, next) {
    if (!session.current) return;
    const value =
      typeof next === "function" ? next(current.current[key]) : next;
    current.current = { ...current.current, [key]: value };
    setChoices(current.current);
    persist(current.current);
  }
  async function discard() {
    await pending.current.catch(() => {});
    await window.orbit.discardSetupDraft(session.current);
    session.current = null;
    current.current = defaults.current;
    setChoices(current.current);
    setReady(false);
    setRecovered(false);
    setAttempt((value) => value + 1);
  }
  return {
    choices,
    setField,
    ready,
    status,
    error,
    recovered,
    discard,
    flush: () => pending.current,
    retry: () =>
      ready ? persist(current.current) : setAttempt((value) => value + 1),
  };
}
