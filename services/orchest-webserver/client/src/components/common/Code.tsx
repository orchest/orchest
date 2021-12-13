import { styled } from "@mui/material/styles";

export const Code = styled("span")(({ theme }) => ({
  fontFamily: "monospace",
  background: theme.palette.grey[200],
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.25, 0.5),
  display: "inline-block",
  marginBottom: theme.spacing(0.5),
}));
