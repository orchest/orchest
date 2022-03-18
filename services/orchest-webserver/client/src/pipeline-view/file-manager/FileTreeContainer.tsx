import Box from "@mui/material/Box";
import React from "react";
import { useFileManagerContext } from "./FileManagerContext";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

export const FileTreeContainer: React.FC = ({ children }) => {
  const { setSelectedFiles } = useFileManagerContext();
  const { handleContextMenu } = useFileManagerLocalContext();
  return (
    <Box
      sx={{
        userSelect: "none",
        whiteSpace: "nowrap",
        maxHeight: "100%",
        overflowY: "auto",
        flex: 1,
      }}
      onContextMenu={(e) => {
        handleContextMenu(e, undefined, "background");
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // click away should clean up selected items
        if (e.detail === 1 && !(e.metaKey || e.ctrlKey)) {
          setSelectedFiles([]);
        }
      }}
    >
      {children}
    </Box>
  );
};
