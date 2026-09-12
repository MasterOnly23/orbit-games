import { MenuItem, TextField } from "@mui/material";
import languages from "../../../electron/library/metadata-languages.json";

export default function MetadataLocaleFields({
  language,
  country,
  onLanguage,
  onCountry,
  disabled,
}) {
  return (
    <>
      <TextField
        select
        fullWidth
        label="Idioma de las fichas"
        value={language}
        onChange={(event) => onLanguage(event.target.value)}
        disabled={disabled}
      >
        {Object.entries(languages).map(([id, label]) => (
          <MenuItem key={id} value={id}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        fullWidth
        label="Región de consulta"
        value={country}
        onChange={(event) => onCountry(event.target.value.toUpperCase())}
        disabled={disabled}
        error={!/^(?:[A-Z]{2})?$/.test(country)}
        slotProps={{ htmlInput: { maxLength: 2 } }}
        helperText="Código de país de dos letras: AR, MX, CO, ES, BR, US… Vacío: la tienda determina la región."
      />
    </>
  );
}
