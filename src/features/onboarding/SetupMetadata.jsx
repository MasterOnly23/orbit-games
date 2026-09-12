import { FormControlLabel, Stack, Switch } from "@mui/material";
import MetadataLocaleFields from "../settings/MetadataLocaleFields";

export default function SetupMetadata({
  online,
  onOnline,
  language,
  onLanguage,
  country,
  onCountry,
  busy,
}) {
  return (
    <section className="setup-panel">
      <h2>Fichas y portadas</h2>
      <FormControlLabel
        control={
          <Switch
            disabled={busy}
            checked={online}
            onChange={(event) => onOnline(event.target.checked)}
          />
        }
        label="Consultar portadas y fichas en línea"
      />
      <p className="setup-note">
        Al activar esta opción, Orbit envía nombres e identificadores de juegos
        a Steam para buscar coincidencias. Puedes usar tu biblioteca sin estas
        consultas y añadir portadas manualmente.
      </p>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <MetadataLocaleFields
          language={language}
          country={country}
          onLanguage={onLanguage}
          onCountry={onCountry}
          disabled={busy}
        />
      </Stack>
      <p className="setup-note">
        La traducción depende de cada juego. Estas preferencias se guardan al
        finalizar, aunque desactives las consultas. No cambian el idioma de
        Orbit ni el país de tu cuenta. Puedes modificarlas después en Ajustes.
      </p>
    </section>
  );
}
