import Stack, { StackProps } from "@mui/material/Stack";
import { SxProps, Theme } from "@mui/material/styles";
import React from "react";

const baseSx: SxProps<Theme> = {
  flex: 1,
  width: "100%",
  direction: "column",
  maxWidth: (theme) => theme.spacing(144),
  margin: "0 auto",
  padding: (theme) => theme.spacing(0, 5),
};

/**
 * Provides a `Stack` component that aligns the content in the center with some horizontal padding.
 * Commonly used inside the `ScrollPane` and `StickyHeader` to ensure content has the same width in both.
 */
export const CenteredStack = React.forwardRef<HTMLDivElement, StackProps>(
  function CenteredStack({ sx, ...props }, ref) {
    return <Stack {...props} ref={ref} sx={{ ...baseSx, ...sx }} />;
  }
);
