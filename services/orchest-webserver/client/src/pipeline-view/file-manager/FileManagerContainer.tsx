import Box from "@mui/material/Box";
import React from "react";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

export const FileManagerContainer: React.FC<{
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ children, setSelected }) => {
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
          setSelected([]);
        }
      }}
    >
      {children}
    </Box>
  );
};
