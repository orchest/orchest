import { blue, grey, red } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

const ORCHEST_BLUE = "#4381ff";

const theme = createTheme({
  palette: {
    primary: { main: ORCHEST_BLUE, ...blue },
    secondary: { main: grey[900], ...grey },
    error: { main: red.A400, ...red },
    background: { default: grey[100] },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
