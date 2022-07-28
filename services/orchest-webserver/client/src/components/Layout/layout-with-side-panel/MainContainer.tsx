import Box, { BoxProps } from "@mui/material/Box";
import React from "react";

type MainContainerProps = BoxProps & {
  disablePadding?: boolean;
  children: React.ReactNode;
};

export const MainContainer = ({
  disablePadding,
  children,
  sx,
  ...props
}: MainContainerProps) => {
  return (
    <Box
      sx={{
        padding: (theme) => (disablePadding ? 0 : theme.spacing(4)),
        overflow: "hidden auto",
        flex: 1,
        ...sx,
      }}
      {...props}
    >
      <Box sx={{ maxWidth: (theme) => theme.spacing(144), margin: "0 auto" }}>
        {children}
      </Box>
    </Box>
  );
};
