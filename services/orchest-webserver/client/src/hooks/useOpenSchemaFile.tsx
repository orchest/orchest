import React from "react";
import { useCreateFile } from "../pipeline-view/file-manager/useCreateFile";
import { useOpenNoteBook } from "../pipeline-view/hooks/useOpenNoteBook";

export type JsonSchemaType = "schema" | "uischema";

export const useOpenSchemaFile = (
  shouldCreateFile: (type: JsonSchemaType) => boolean
) => {
  const shouldCreateFileRef = React.useRef(shouldCreateFile);

  React.useEffect(() => {
    shouldCreateFileRef.current = shouldCreateFile;
  }, [shouldCreateFile]);

  const openFile = useOpenNoteBook();
  const createFile = useCreateFile("/project-dir");

  const openSchemaFile = React.useCallback(
    async (e: React.MouseEvent, filePath: string, type: JsonSchemaType) => {
      const shouldCreateFile = shouldCreateFileRef.current(type);

      const sidecarFilePath = `${filePath}.${type}.json`;
      if (shouldCreateFile) await createFile(sidecarFilePath);
      openFile(e, sidecarFilePath);
    },
    [createFile, openFile]
  );

  return { openSchemaFile };
};
