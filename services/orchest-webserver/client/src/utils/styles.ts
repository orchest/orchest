import { SxProps, Theme } from "@mui/material/styles";

export const ellipsis = (
  maxWidth: string | ((theme: Theme) => string | number) = "100%"
): SxProps<Theme> => ({
  maxWidth,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
