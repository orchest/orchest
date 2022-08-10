import { JsonSchemaType, useOpenSchemaFile } from "@/hooks/useOpenSchemaFile";
import { join } from "@/utils/path";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useStepDetailsContext } from "./StepDetailsContext";

export const useOpenStepSchemaFile = () => {
  const { pipelineCwd } = usePipelineEditorContext();

  const { step, parameterSchema, parameterUiSchema } = useStepDetailsContext();
  const { openSchemaFile } = useOpenSchemaFile(
    (type) =>
      (type === "schema" && !hasValue(parameterSchema)) ||
      (type === "uischema" && !hasValue(parameterUiSchema))
  );

  const openStepSchemaFile = React.useCallback(
    (event: React.MouseEvent, type: JsonSchemaType) => {
      if (!pipelineCwd) return;
      openSchemaFile(event, join(pipelineCwd, step.file_path), type);
    },
    [openSchemaFile, step.file_path, pipelineCwd]
  );

  return { openStepSchemaFile };
};
