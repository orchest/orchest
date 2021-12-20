import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";

export const Layout = styled(Box)<{ disablePadding?: boolean }>(
  ({ theme, disablePadding }) => ({
    flex: 1,
    padding: disablePadding ? 0 : theme.spacing(3),
  })
);
