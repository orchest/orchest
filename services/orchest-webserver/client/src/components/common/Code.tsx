import { styled } from "@mui/material/styles";

export const Code = styled("span")<{ dark?: boolean }>(({ theme, dark }) => ({
  fontFamily: "monospace",
  background: dark ? theme.palette.grey[800] : theme.palette.grey[200],
  color: dark ? theme.palette.common.white : theme.palette.secondary.main,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.25, 0.75),
  display: "inline-block",
  marginBottom: theme.spacing(0.5),
}));
