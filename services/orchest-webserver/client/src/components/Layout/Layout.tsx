import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import React from "react";

export const Layout: React.FC<{
  disablePadding?: boolean;
  toolbarElements?: React.ReactNode;
}> = ({ children, disablePadding, toolbarElements }) => {
  return (
    <Stack direction="column" sx={{ position: "relative", height: "100%" }}>
      <Toolbar />
      {toolbarElements && (
        <Toolbar
          sx={{
            width: "100%",
            backgroundColor: (theme) => theme.palette.common.white,
            borderBottom: (theme) => `1px solid ${theme.borderColor}`,
          }}
        >
          {toolbarElements}
        </Toolbar>
      )}
      <Box
        sx={{
          padding: (theme) => (disablePadding ? 0 : theme.spacing(4)),
          overflow: "hidden auto",
          flex: 1,
        }}
      >
        {children}
      </Box>
    </Stack>
  );
};
