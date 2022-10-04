import { ParameterEditorWithJsonForm } from "@/components/ParameterEditorWithJsonForm";
import { Json, StepState } from "@/types";
import React from "react";
import { useStepDetailsContext } from "./StepDetailsContext";
import { useOpenStepSchemaFile } from "./useOpenStepSchemaFile";

type StepParametersProps = {
  isReadOnly: boolean;
  setStepChanges: (changes: React.SetStateAction<Partial<StepState>>) => void;
};

export const StepParameters = ({
  isReadOnly,
  setStepChanges,
}: StepParametersProps) => {
  const { step, parameterSchema, parameterUiSchema } = useStepDetailsContext();
  const { openStepSchemaFile } = useOpenStepSchemaFile();

  const onSaveParameters = React.useCallback(
    (parameters: Record<string, Json> | undefined) => {
      setStepChanges({ parameters });
    },
    [setStepChanges]
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
