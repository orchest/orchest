import { CenteredStack, MainContainer } from "@/components/layout";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import React from "react";

// TODO: Replace the Layout component with this when other views are implemented
export const TempLayout: React.FC<{
  toolbarElements?: React.ReactNode;
  loading?: boolean;
}> = ({ children, toolbarElements, loading }) => {
  return (
    <Stack
      direction="column"
      sx={{
        position: "relative",
        height: "100%",
        width: "100%",
      }}
    >
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
      <MainContainer
        sx={{
          marginTop: (theme) =>
            loading && !toolbarElements ? theme.spacing(-0.5) : 0,
        }}
      >
        <CenteredStack sx={{ paddingTop: (theme) => theme.spacing(4) }}>
          {children}
        </CenteredStack>
      </MainContainer>
    </Stack>
  );
};
