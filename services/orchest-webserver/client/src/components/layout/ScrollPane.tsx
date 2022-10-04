import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";

export const SCROLL_PANE_CLASS = "ScrollPane";

/** A scrollable pane commonly used for the main content of the view. */
export const ScrollPane = ({ ...props }: StackProps) => (
  <Stack
    className={SCROLL_PANE_CLASS}
    width="100%"
    justifyContent="flex-start"
    alignItems="flex-start"
    overflow="auto"
    {...props}
  />
);
