import { useEffect, useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import MetadataLocaleFields from "./MetadataLocaleFields";

export default function MetadataPreferences({ settings, action }) {
  const [language, setLanguage] = useState(
    settings.metadataLanguage || "spanish",
  );
  const [country, setCountry] = useState(settings.metadataCountry || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLanguage(settings.metadataLanguage || "spanish");
    setCountry(settings.metadataCountry || "");
  }, [settings.metadataLanguage, settings.metadataCountry]);
  const valid = /^(?:[A-Z]{2})?$/.test(country);
  return (
    <Stack
      component="form"
      spacing={2}
      sx={{ py: 2 }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        await action(
          () =>
            window.orbit.settings({
              metadataLanguage: language,
              metadataCountry: country,
            }),
          "Preferencias de fichas guardadas",
        );
        setBusy(false);
      }}
    >
      <Typography component="h3" variant="subtitle1">
        Idioma y región de las fichas
      </Typography>
      <MetadataLocaleFields
        language={language}
        country={country}
        onLanguage={setLanguage}
        onCountry={setCountry}
        disabled={busy}
      />
      <Typography variant="body2" color="text.secondary">
        Afecta búsquedas y actualizaciones nuevas cuando activas las fichas en
        línea. Para cambiar una ficha guardada, usa Actualizar ficha en ese
        juego. No cambia el idioma de Orbit, del juego ni el país de tu cuenta.
      </Typography>
      <Button type="submit" variant="outlined" disabled={busy || !valid}>
        Guardar idioma y región
      </Button>
    </Stack>
  );
}
