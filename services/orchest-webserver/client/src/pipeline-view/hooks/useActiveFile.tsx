import { useFileApi } from "@/api/files/useFileApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { FileRoot } from "@/utils/file";
import { basename, extname } from "@/utils/path";
import React from "react";
import { useStepFile } from "./useStepFile";

type ActiveFile = {
  extension: string;
  content: string;
  name: string;
  hasStep: boolean;
};

export const useActiveFile = (): ActiveFile | undefined => {
  const { stepFile } = useStepFile();
  const { filePath, fileRoot, stepUuid } = useCustomRoute();
  const readFile = useFileApi((api) => api.read);
  const { projectUuid } = useCustomRoute();
  const [content, setContent] = React.useState<string>();
  const [name, setName] = React.useState<string>();

  React.useEffect(() => {
    if (!projectUuid || !filePath || !fileRoot || stepUuid) return;

    readFile(fileRoot as FileRoot, filePath)
      .then(setContent)
      .then(() => setName(basename(filePath)));
  }, [fileRoot, filePath, projectUuid, stepUuid, readFile]);

  React.useEffect(() => {
    if (!stepFile) return;

    setContent(stepFile.content);
    setName(stepFile.filename);
  }, [stepFile]);

  if (!content || !name) return undefined;

  return {
    content,
    name,
    hasStep: Boolean(stepFile && !fileRoot && !filePath),
    extension: extname(name),
  };
};
