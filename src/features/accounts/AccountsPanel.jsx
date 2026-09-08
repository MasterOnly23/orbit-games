import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";

export default function AccountsPanel({ accounts = [] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const run = async (operation, success) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await operation();
      setMessage(
        result.ok
          ? { severity: "success", text: success }
          : { severity: "error", text: result.error.message },
      );
    } catch {
      setMessage({
        severity: "error",
        text: "No se pudo completar la operación. Vuelve a intentarlo.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={2} sx={{ py: 2 }}>
      <Typography variant="h6">Cuentas de juegos</Typography>
      <Typography variant="body2" color="text.secondary">
        Conecta tus cuentas para consultar también juegos sin instalación local.
        El inicio de sesión ocurre en la página de cada plataforma. Orbit guarda
        una sesión propia en este equipo.
      </Typography>
      <Alert severity="info">
        Conectores comunitarios experimentales. Las plataformas pueden cambiar
        su funcionamiento; las conexiones reales todavía están en validación. No
        se garantiza juegos compartidos por otras cuentas.
      </Alert>
      {accounts.map((account) => (
        <Stack
          spacing={1}
          key={account.id}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            p: 2,
            borderRadius: 2,
          }}
        >
          <Typography fontWeight={600}>
            {account.provider} · {account.displayName}
          </Typography>
          <Typography variant="body2">
            Última sincronización:{" "}
            {account.lastSuccess
              ? new Date(account.lastSuccess).toLocaleString()
              : "Pendiente"}
          </Typography>
          {account.error && (
            <Alert severity="warning">{account.error.message}</Alert>
          )}
          <Stack direction="row" spacing={1}>
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () => window.orbit.syncAccount(account.id),
                  "Biblioteca sincronizada.",
                )
              }
            >
              Sincronizar
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () => window.orbit.disconnectAccount(account.id),
                  "Sesión eliminada de Orbit. Se conservan los juegos y sus ajustes.",
                )
              }
            >
              Desconectar
            </Button>
          </Stack>
        </Stack>
      ))}
      {[
        { id: "steam", name: "Steam" },
        { id: "gog", name: "GOG" },
      ].map((provider) => (
        <Button
          key={provider.id}
          variant="outlined"
          disabled={busy}
          onClick={() =>
            run(
              () => window.orbit.connectAccount(provider.id),
              "Cuenta conectada y biblioteca importada.",
            )
          }
        >
          {busy ? "Procesando…" : `Conectar ${provider.name}`}
        </Button>
      ))}
      <Typography variant="caption" color="text.secondary">
        Desconectar elimina la sesión de Orbit de este equipo y conserva los
        juegos importados. Puedes usar la biblioteca local sin conectar cuentas.
      </Typography>
      {message && <Alert severity={message.severity}>{message.text}</Alert>}
    </Stack>
  );
}
