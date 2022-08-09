import { join } from "@/utils/path";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useCreateFile } from "../file-manager/useCreateFile";
import { useOpenNoteBook } from "../hooks/useOpenNoteBook";
import { useStepDetailsContext } from "./StepDetailsContext";

export const useOpenSchemaFile = () => {
  const { pipelineCwd } = usePipelineEditorContext();

  const openFile = useOpenNoteBook();
  const { step, parameterSchema, parameterUiSchema } = useStepDetailsContext();
  const createFile = useCreateFile("/project-dir");

  const openSchemaFile = async (
    e: React.MouseEvent,
    fileExtension: ".schema.json" | ".uischema.json"
  ) => {
    if (!pipelineCwd) return;

    const shouldCreateFile =
      (fileExtension === ".schema.json" && !parameterSchema) ||
      (fileExtension === ".uischema.json" && !parameterUiSchema);

    const filePath = join(pipelineCwd, `${step.file_path}${fileExtension}`);
    if (shouldCreateFile) await createFile(filePath);
    openFile(e, filePath);
  };

  return { openSchemaFile };
};
