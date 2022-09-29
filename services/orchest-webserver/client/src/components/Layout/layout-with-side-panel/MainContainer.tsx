import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";

export const MAIN_CONTAINER_CLASS = "MainContainer";

export const MainContainer = ({ ...props }: StackProps) => (
  <Stack
    className={MAIN_CONTAINER_CLASS}
    width="100%"
    justifyContent="flex-start"
    alignItems="flex-start"
    overflow="auto"
    {...props}
  />
);
