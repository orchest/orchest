import { blue, common, grey, red } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

const ORCHEST_BLUE = "#4381ff";

declare module "@mui/material/styles" {
  interface Theme {
    borderColor?: string;
  }
  // allow configuration using `createTheme`
  interface ThemeOptions {
    borderColor?: string;
  }
}

const theme = createTheme({
  palette: {
    primary: { main: ORCHEST_BLUE, ...blue },
    secondary: { main: grey[900], ...grey },
    error: { main: red.A400, ...red },
    background: { default: common.white },
  },
  borderColor: "rgba(0, 0, 0, 0.12)",
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
  // tree: {
  //   active: {
  //     bgColor: "#e8f0fe",
  //     color: "#1a73e8",
  //   },
  //   fontSize: "0.9rem",
  // },
});

export default theme;
