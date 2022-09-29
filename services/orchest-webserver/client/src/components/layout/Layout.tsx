import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import React from "react";

export const Layout: React.FC<{
  disablePadding?: boolean;
  toolbarElements?: React.ReactNode;
  loading?: boolean;
}> = ({ children, disablePadding, toolbarElements, loading }) => {
  return (
    <Stack direction="column" sx={{ position: "relative", height: "100%" }}>
      <Toolbar variant="dense" sx={{ height: (theme) => theme.spacing(7) }} />
      {loading && <LinearProgress sx={{ zIndex: 1 }} />}
      {toolbarElements && (
        <Toolbar
          sx={{
            width: "100%",
            backgroundColor: (theme) => theme.palette.common.white,
            borderBottom: (theme) => `1px solid ${theme.borderColor}`,
            marginTop: (theme) => (loading ? theme.spacing(-0.5) : 0),
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
          marginTop: (theme) =>
            loading && !toolbarElements ? theme.spacing(-0.5) : 0,
        }}
      >
        {children}
      </Box>
    </Stack>
  );
};
