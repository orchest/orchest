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
        maxHeight: "100%",
        overflowY: "auto",
        flex: 1,
        padding: (theme) => theme.spacing(0, 1, 2),
      }}
      onContextMenu={(event) => handleContextMenu(event, "")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // click away should clean up selected items
        if (event.detail === 1 && !(event.metaKey || event.ctrlKey)) {
          setSelectedFiles([]);
        }
      }}
    >
      {children}
    </Box>
  );
};
