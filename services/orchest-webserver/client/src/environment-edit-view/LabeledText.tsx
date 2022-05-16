import { SxProps, Theme } from "@mui/material";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const LabeledText: React.FC<{
  caption: string;
  sx?: SxProps<Theme>;
}> = ({ children, caption, sx }) => {
  return (
    <Stack
      direction="column"
      alignItems="flex-start"
      sx={{ minWidth: (theme) => theme.spacing(12), ...sx }}
    >
      <Typography
        variant="caption"
        sx={{
          color: (theme) => theme.palette.grey[700],
        }}
      >
        {caption}
      </Typography>
      <Typography>{children}</Typography>
    </Stack>
  );
};
