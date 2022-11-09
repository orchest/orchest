import { ParameterEditorWithJsonForm } from "@/components/ParameterEditorWithJsonForm";
import { Json } from "@/types";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import React from "react";
import { useOpenPipelineSchemaFile } from "./hooks/useOpenPipelineSchemaFile";

type PipelineParametersProps = {
  initialValue: string | undefined;
  isReadOnly: boolean;
  onSave: (value: string) => void;
  pipelinePath: string | undefined;
  parameterSchema: JsonSchema | undefined;
  parameterUiSchema: UISchemaElement | undefined;
  showGenerateParametersDialog: () => void;
};

export const PipelineParameters = ({
  initialValue,
  isReadOnly,
  onSave,
  pipelinePath,
  parameterSchema,
  parameterUiSchema,
  showGenerateParametersDialog,
}: PipelineParametersProps) => {
  const { openPipelineSchemaFile } = useOpenPipelineSchemaFile(
    `/${pipelinePath}`,
    parameterSchema,
    parameterUiSchema
  );

  const onChangePipelineParameters = React.useCallback(
    (value: Record<string, Json> | undefined) => {
      onSave(JSON.stringify(value));
    },
    [onSave]
  );

  const parsedJson = React.useMemo<Json | undefined>(() => {
    try {
      return initialValue ? JSON.parse(initialValue) : undefined;
    } catch (error) {}
  }, [initialValue]);

  return parsedJson ? (
    <ParameterEditorWithJsonForm
      initialValue={parsedJson}
      isReadOnly={isReadOnly}
      parameterSchema={parameterSchema}
      parameterUiSchema={parameterUiSchema}
      onSave={onChangePipelineParameters}
      openSchemaFile={openPipelineSchemaFile}
      menuItems={[
        {
          label: "See example job parameters file",
          action: showGenerateParametersDialog,
          disabled: isReadOnly,
        },
      ]}
    />
  ) : null;
};
