import { useOpenFile } from "@/pipeline-view/hooks/useOpenFile";
import React from "react";
import { useCreateFile } from "../pipeline-view/file-manager/useCreateFile";

export type JsonSchemaType = "schema" | "uischema";

export const useOpenSchemaFile = (
  shouldCreateFile: (type: JsonSchemaType) => boolean
) => {
  const shouldCreateFileRef = React.useRef(shouldCreateFile);

  React.useEffect(() => {
    shouldCreateFileRef.current = shouldCreateFile;
  }, [shouldCreateFile]);

  const { openNotebook } = useOpenFile();
  const createFile = useCreateFile("/project-dir");

  const openSchemaFile = React.useCallback(
    async (e: React.MouseEvent, filePath: string, type: JsonSchemaType) => {
      const shouldCreateFile = shouldCreateFileRef.current(type);

      const sidecarFilePath = `${filePath}.${type}.json`;
      if (shouldCreateFile) await createFile(sidecarFilePath);
      openNotebook(e, sidecarFilePath);
    },
    [createFile, openNotebook]
  );

  return { openSchemaFile };
};
