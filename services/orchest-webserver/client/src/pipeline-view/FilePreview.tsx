import Stack from "@mui/material/Stack";
import React from "react";
import {
  CodePreview,
  FilePreviewHeader,
  NotebookPreview,
} from "./file-preview";
import { useActiveFile } from "./hooks/useActiveFile";

export const FilePreview = () => {
  const file = useActiveFile();

  if (!file) return null;

  const isNotebook = file.extension === ".ipynb";

  return (
    <Stack width="100%" overflow="auto">
      <FilePreviewHeader name={file.name} isStep={file.source === "step"} />
      <Stack flex="1" width="100%">
        {isNotebook && file.source === "step" ? (
          <NotebookPreview content={file.content} />
        ) : (
          <CodePreview content={file.content} extension={file.extension} />
        )}
      </Stack>
    </Stack>
  );
};
