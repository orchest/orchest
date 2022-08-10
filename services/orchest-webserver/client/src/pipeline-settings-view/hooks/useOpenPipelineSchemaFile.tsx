import { JsonSchemaType, useOpenSchemaFile } from "@/hooks/useOpenSchemaFile";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useOpenPipelineSchemaFile = (
  pipelinePath: string | undefined,
  parameterSchema: JsonSchema | undefined,
  parameterUiSchema: UISchemaElement | undefined
) => {
  const { openSchemaFile } = useOpenSchemaFile(
    (type) =>
      (type === "schema" && !hasValue(parameterSchema)) ||
      (type === "uischema" && !hasValue(parameterUiSchema))
  );

  const openPipelineSchemaFile = React.useCallback(
    (event: React.MouseEvent, type: JsonSchemaType) => {
      if (pipelinePath) openSchemaFile(event, pipelinePath, type);
    },
    [openSchemaFile, pipelinePath]
  );

  return { openPipelineSchemaFile };
};
