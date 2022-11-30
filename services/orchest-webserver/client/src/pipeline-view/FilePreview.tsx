import Stack from "@mui/material/Stack";
import React from "react";
import {
  CodePreview,
  FilePreviewHeader,
  NotebookPreview,
} from "./file-preview";
import { useStepFile } from "./hooks/useStepFile";

export const FilePreview = () => {
  const { file } = useStepFile();
  const isNotebook = file?.ext === "ipynb";

  if (!file) return null;

  return (
    <Stack flex="1">
      <FilePreviewHeader file={file} />
      <Stack flex="1">
        {isNotebook ? (
          <NotebookPreview file={file} />
        ) : (
          <CodePreview file={file} />
        )}
      </Stack>
    </Stack>
  );
};
