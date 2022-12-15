import Box from "@mui/material/Box";
import React from "react";
import { useFileManagerLocalContext } from "../contexts/FileManagerLocalContext";
import { useFileManagerState } from "../hooks/useFileManagerState";

export const FileTreeContainer: React.FC = ({ children }) => {
  const setSelectedFiles = useFileManagerState((state) => state.setSelected);
  const { handleContextMenu } = useFileManagerLocalContext();
  const containerRef = React.useRef<HTMLElement>();

  return (
    <Box
      ref={containerRef}
      sx={{
        userSelect: "none",
        maxHeight: "100%",
        overflowY: "auto",
        flex: 1,
        padding: (theme) => theme.spacing(0, 1, 2),
      }}
      onContextMenu={(event) => handleContextMenu(event, "")}
      onClick={(event) => {
        if (event.target !== containerRef.current) return;

        setSelectedFiles([]);
      }}
    >
      {children}
    </Box>
  );
};
