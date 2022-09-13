import Box, { BoxProps } from "@mui/material/Box";
import React from "react";

export type MainContainerProps = BoxProps & {
  disablePadding?: boolean;
};

export const MainContainer = React.forwardRef<
  HTMLDivElement,
  MainContainerProps
>(function MainContainer({ disablePadding, children, sx, ...props }, ref) {
  return (
    <Box
      sx={{
        padding: (theme) => (disablePadding ? 0 : theme.spacing(5)),
        overflow: "hidden auto",
        flex: 1,
        ...sx,
      }}
      {...props}
      ref={ref}
    >
      <Box
        sx={{
          maxWidth: (theme) => theme.spacing(144),
          margin: "0 auto",
          height: "100%",
        }}
      >
        {children}
      </Box>
    </Box>
  );
});
