import { blue, grey, red } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

export type ColorScale = Record<
  "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900",
  string
>;

const ORCHEST_BLUE: ColorScale = {
  50: "#e0eeff",
  100: "#b0ccff",
  200: "#7faaff",
  300: "#4381ff",
  400: "#1e65fe",
  500: "#074ce5",
  600: "#003bb3",
  700: "#002a81",
  800: "#001950",
  900: "#000820",
};

const theme = createTheme({
  palette: {
    primary: { main: ORCHEST_BLUE["400"], ...blue },
    secondary: { main: grey[900], ...grey },
    error: { main: red.A400, ...red },
    background: { default: grey[100] },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
