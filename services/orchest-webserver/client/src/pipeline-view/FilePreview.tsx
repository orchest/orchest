import { useOnce } from "@/hooks/useOnce";
import { combinePath } from "@/utils/file";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import {
  CodePreview,
  FilePreviewHeader,
  NotebookPreview,
} from "./file-preview";
import { useActiveFile } from "./hooks/useActiveFile";
import { useFileManagerState } from "./hooks/useFileManagerState";

export const FilePreview = () => {
  const file = useActiveFile();
  const selectedFiles = useFileManagerState((state) => state.selected);
  const selectExclusive = useFileManagerState((state) => state.selectExclusive);

  useOnce(hasValue(file), () => {
    if (selectedFiles.length === 0 && file) {
      selectExclusive(combinePath(file));
    }
  });

  if (!file) return null;

  const isNotebook = file.extension === ".ipynb";

  return (
    <Stack width="100%" overflow="auto">
      <FilePreviewHeader name={file.name} isStep={file.hasStep} />
      <Stack flex="1" width="100%">
        {isNotebook ? (
          <NotebookPreview content={file.content} />
        ) : (
          <CodePreview content={file.content} extension={file.extension} />
        )}
      </Stack>
    </Stack>
  );
};
