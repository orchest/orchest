import { join } from "@/utils/path";
import React from "react";
import { usePipelineEditorContext } from "../pipeline-view/contexts/PipelineEditorContext";
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

  const { pipelineCwd } = usePipelineEditorContext();

  const openFile = useOpenNoteBook();
  const createFile = useCreateFile("/project-dir");

  const openSchemaFile = React.useCallback(
    async (e: React.MouseEvent, filePath: string, type: JsonSchemaType) => {
      if (!pipelineCwd) return;

      const shouldCreateFile = shouldCreateFileRef.current(type);

      const sidecarFilePath = join(pipelineCwd, `${filePath}.${type}.json`);
      if (shouldCreateFile) await createFile(sidecarFilePath);
      openFile(e, filePath);
    },
    [createFile, openFile, pipelineCwd]
  );

  return { openSchemaFile };
};
