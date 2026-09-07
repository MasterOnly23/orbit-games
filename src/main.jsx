import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";
import "./theme.css";
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ff815b" },
    background: { default: "#0d1016", paper: "#171b24" },
    text: { primary: "#f4f5f8", secondary: "#939cad" },
  },
  typography: {
    fontFamily: '"Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: "none", border: "1px solid #2a303d" },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiOutlinedInput: { styleOverrides: { root: { fontSize: 14 } } },
  },
});
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);
