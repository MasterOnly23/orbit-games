import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export default function PlatformCoverage() {
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    window.orbit
      .accountCoverage()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <Box
      component="details"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Box component="summary" sx={{ cursor: "pointer", fontWeight: 600 }}>
        Cobertura por plataforma
      </Box>
      <Stack spacing={2} sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          La detección local identifica instalaciones o accesos. La conexión de
          cuenta añade los juegos que devuelve el proveedor, aunque no estén
          instalados. Todas las conexiones habilitadas siguen siendo
          experimentales.
        </Typography>
        {failed ? (
          <Alert
            severity="error"
            action={
              <Button onClick={() => setAttempt((value) => value + 1)}>
                Reintentar
              </Button>
            }
          >
            No se pudo cargar la cobertura.
          </Alert>
        ) : !items ? (
          <Typography role="status">Cargando cobertura…</Typography>
        ) : (
          items.map((item) => (
            <Box key={item.id}>
              <Typography component="h4" variant="subtitle2">
                {item.name} ·{" "}
                {item.canConnect
                  ? "Conexión experimental disponible"
                  : "Sin conexión de cuenta habilitada"}
              </Typography>
              <Typography variant="body2">
                <strong>En este equipo:</strong> {item.local}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Cuenta:</strong> {item.account}
              </Typography>
            </Box>
          ))
        )}
      </Stack>
    </Box>
  );
}
