import { SxProps, Theme } from "@mui/material/styles";

export const ellipsis = (maxWidth: string): SxProps<Theme> => ({
  maxWidth,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
