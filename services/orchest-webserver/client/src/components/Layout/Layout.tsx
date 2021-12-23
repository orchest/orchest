import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";

export const Layout = styled(Box)<{
  disablePadding?: boolean;
  fullHeight?: boolean;
}>(({ theme, disablePadding, fullHeight }) => ({
  height: fullHeight ? "100%" : undefined,
  padding: disablePadding ? 0 : theme.spacing(4),
}));
