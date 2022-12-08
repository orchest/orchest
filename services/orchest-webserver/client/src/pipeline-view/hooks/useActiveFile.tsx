import { filesApi } from "@/api/files/fileApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { FileRoot } from "@/utils/file";
import { addLeadingSlash, basename, extname } from "@/utils/path";
import React from "react";
import { useStepFile } from "./useStepFile";

type ActiveFile = {
  extension: string;
  content: string;
  name: string;
  source: "file" | "step";
};

export const useActiveFile = (): ActiveFile | undefined => {
  const { stepFile } = useStepFile();
  const { filePath, fileRoot, stepUuid } = useCustomRoute();
  const { projectUuid } = useCustomRoute();
  const [content, setContent] = React.useState<string>();
  const [name, setName] = React.useState<string>();

  React.useEffect(() => {
    if (!projectUuid || !filePath || !fileRoot || stepUuid) return;

    filesApi
      .downloadFile(
        projectUuid,
        fileRoot as FileRoot,
        addLeadingSlash(filePath)
      )
      .then(setContent)
      .then(() => setName(basename(filePath)));
  }, [fileRoot, filePath, projectUuid, stepUuid]);

  React.useEffect(() => {
    if (!stepFile) return;

    setContent(stepFile.content);
    setName(stepFile.filename);
  }, [stepFile]);

  if (!content || !name) return undefined;

  return {
    content,
    name,
    source: stepFile && !fileRoot && !filePath ? "step" : "file",
    extension: extname(name),
  };
};
