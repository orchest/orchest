import { useFileApi } from "@/api/files/useFileApi";
import { useCurrentQuery } from "@/hooks/useCustomRoute";
import { FileRoot } from "@/utils/file";
import { basename, extname } from "@/utils/path";
import React from "react";
import { useStepFile } from "./useStepFile";

type ActiveFile = {
  extension: string;
  content: string;
  name: string;
  hasStep: boolean;
  root: FileRoot;
  path: string;
};

export const useActiveFile = (): ActiveFile | undefined => {
  const { stepFile } = useStepFile();
  const { projectUuid, filePath, fileRoot, stepUuid } = useCurrentQuery();
  const readFile = useFileApi((api) => api.read);
  const [active, setActive] = React.useState<ActiveFile>();

  React.useEffect(() => {
    if (!projectUuid || !filePath || !fileRoot || stepUuid) return;

    readFile(fileRoot as FileRoot, filePath).then((content) =>
      setActive({
        extension: extname(filePath),
        name: basename(filePath),
        root: fileRoot as FileRoot,
        path: filePath,
        hasStep: false,
        content,
      })
    );
  }, [fileRoot, filePath, projectUuid, stepUuid, readFile]);

  React.useEffect(() => {
    if (!stepFile) return;

    setActive({
      name: basename(stepFile.path),
      extension: extname(stepFile.path),
      hasStep: true,
      ...stepFile,
    });
  }, [stepFile]);

  return active;
};
