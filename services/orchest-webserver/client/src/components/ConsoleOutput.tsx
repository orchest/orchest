import { styled } from "@mui/material/styles";

export const ConsoleOutput = styled("div")(({ theme }) => ({
  width: "100%",
  maxWidth: "800px",
  fontFamily: "monospace",
  fontSize: "13px",
  background: theme.palette.common.black,
  color: theme.palette.common.white,
  padding: theme.spacing(3),
  whiteSpace: "pre-line",
  overflowX: "auto",
}));
