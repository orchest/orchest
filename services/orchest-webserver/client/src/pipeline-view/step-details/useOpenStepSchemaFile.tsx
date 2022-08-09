import { JsonSchemaType, useOpenSchemaFile } from "@/hooks/useOpenSchemaFile";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useStepDetailsContext } from "./StepDetailsContext";

export const useOpenStepSchemaFile = () => {
  const { step, parameterSchema, parameterUiSchema } = useStepDetailsContext();
  const { openSchemaFile } = useOpenSchemaFile(
    (type) =>
      (type === "schema" && !hasValue(parameterSchema)) ||
      (type === "uischema" && !hasValue(parameterUiSchema))
  );

  const openStepSchemaFile = React.useCallback(
    (event: React.MouseEvent, type: JsonSchemaType) => {
      openSchemaFile(event, step.file_path, type);
    },
    [openSchemaFile, step.file_path]
  );

  return { openStepSchemaFile };
};
