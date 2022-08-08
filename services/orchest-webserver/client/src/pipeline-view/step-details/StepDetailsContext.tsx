import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useReadFile } from "@/hooks/useReadFile";
import { PipelineStepState } from "@/types";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import { ALLOWED_STEP_EXTENSIONS } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { ConnectionDict } from "./StepDetailsProperties";

export type StepDetailsContextType = {
  doesStepFileExist: boolean;
  isCheckingFileValidity: boolean;
  step: PipelineStepState;
  connections: ConnectionDict;
  stepSchema?: JsonSchema;
  isReadingSchemaFile: boolean;
  stepUiSchema?: UISchemaElement;
  isReadingUiSchemaFile: boolean;
};

export const StepDetailsContext = React.createContext<StepDetailsContextType>(
  {} as StepDetailsContextType
);

export const useStepDetailsContext = () => React.useContext(StepDetailsContext);
export const StepDetailsContextProvider: React.FC = ({ children }) => {
  const {
    eventVars,
    pipelineUuid,
    projectUuid,
    runUuid,
    jobUuid,
  } = usePipelineEditorContext();

  const step = eventVars.steps[eventVars.openedStep || ""];
  const [doesStepFileExist, isCheckingFileValidity] = useCheckFileValidity({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: step?.file_path,
    allowedExtensions: ALLOWED_STEP_EXTENSIONS,
  });

  const [stepSchema, isReadingSchemaFile] = useReadFile({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: step?.file_path.concat(".schema.json"),
    allowedExtensions: ["json"],
  });

  const [stepUiSchema, isReadingUiSchemaFile] = useReadFile({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: step?.file_path.concat(".uischema.json"),
    allowedExtensions: ["json"],
  });

  const connections = React.useMemo(() => {
    if (!step) return {};

    const { incoming_connections = [] } = step;

    return incoming_connections.reduce((all, id: string) => {
      const { title, file_path } = eventVars.steps[id];
      return { ...all, [id]: { title, file_path } };
    }, {} as ConnectionDict);
  }, [eventVars.steps, step]);

  return (
    <StepDetailsContext.Provider
      value={{
        doesStepFileExist,
        isCheckingFileValidity,
        connections,
        step,
        stepSchema: stepSchema as JsonSchema,
        isReadingSchemaFile,
        stepUiSchema: (stepUiSchema as unknown) as UISchemaElement,
        isReadingUiSchemaFile,
      }}
    >
      {children}
    </StepDetailsContext.Provider>
  );
};
