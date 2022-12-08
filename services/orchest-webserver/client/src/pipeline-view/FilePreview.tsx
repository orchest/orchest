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
    <Stack flex="1">
      <FilePreviewHeader name={file.name} />
      <Stack flex="1">
        {isNotebook && file.source === "step" ? (
          <NotebookPreview content={file.content} />
        ) : (
          <CodePreview content={file.content} extension={file.extension} />
        )}
      </Stack>
    </Stack>
  );
};
