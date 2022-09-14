import Stack from "@mui/material/Stack";
import React from "react";
import { useHotKeysInPipelineEditor } from "./hooks/useHotKeysInPipelineEditor";

export const PipelineEditorRoot = ({ children }) => {
  const { disableHotKeys, enableHotKeys } = useHotKeysInPipelineEditor();

  return (
    <Stack
      className="pipeline-view"
      onMouseOver={enableHotKeys}
      onMouseLeave={disableHotKeys}
      position="relative"
      display="flex"
      direction="row"
      width="100%"
      height="100%"
      max-height="100%"
      overflow="hidden"
    >
      {children}
    </Stack>
  );
};
