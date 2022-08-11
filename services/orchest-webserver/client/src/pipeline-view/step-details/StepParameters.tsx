import { ParameterEditorWithJsonForm } from "@/components/ParameterEditorWithJsonForm";
import { Json, Step } from "@/types";
import React from "react";
import { useStepDetailsContext } from "./StepDetailsContext";
import { useOpenStepSchemaFile } from "./useOpenStepSchemaFile";

type StepParametersProps = {
  isReadOnly: boolean;
  onSave: (
    payload: Pick<Step, "parameters">,
    uuid: string,
    replace?: boolean
  ) => void;
};

export const StepParameters = ({ isReadOnly, onSave }: StepParametersProps) => {
  const { step, parameterSchema, parameterUiSchema } = useStepDetailsContext();
  const { openStepSchemaFile } = useOpenStepSchemaFile();

  const onSaveParameters = React.useCallback(
    (parameters: Json) => {
      onSave({ parameters }, step.uuid, true);
    },
    [step.uuid, onSave]
  );

  return (
    <ParameterEditorWithJsonForm
      initialValue={step.parameters}
      isReadOnly={isReadOnly}
      parameterSchema={parameterSchema}
      parameterUiSchema={parameterUiSchema}
      onSave={onSaveParameters}
      openSchemaFile={openStepSchemaFile}
    />
  );
};
