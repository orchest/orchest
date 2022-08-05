import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useReadFile } from "@/hooks/useReadFile";
import { PipelineStepState } from "@/types";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import { ALLOWED_STEP_EXTENSIONS } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { ConnectionDict } from "./StepDetailsProperties";

export type StepDetailsContextType = {
  doesStepFileExist: boolean;
  isCheckingFileValidity: boolean;
  step: PipelineStepState;
  connections: ConnectionDict;
  parameterSchema?: JsonSchema;
  isReadingSchemaFile: boolean;
  parameterUiSchema?: UISchemaElement;
  isReadingUiSchemaFile: boolean;
};

export const StepDetailsContext = React.createContext<StepDetailsContextType>(
  {} as StepDetailsContextType
);

export const useStepDetailsContext = () => React.useContext(StepDetailsContext);
export const StepDetailsContextProvider: React.FC = ({ children }) => {
  const {
    pipelineUuid,
    runUuid,
    projectUuid,
    jobUuid,
  } = usePipelineDataContext();
  const { eventVars } = usePipelineEditorContext();

  const step = eventVars.steps[eventVars.openedStep || ""];
  const [doesStepFileExist, isCheckingFileValidity] = useCheckFileValidity({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: step?.file_path,
    allowedExtensions: ALLOWED_STEP_EXTENSIONS,
  });

  const [parameterSchema, isReadingSchemaFile] = useReadFile<JsonSchema>({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: step?.file_path.concat(".schema.json"),
    allowedExtensions: ["json"],
  });

  const [parameterUiSchema, isReadingUiSchemaFile] = useReadFile<
    UISchemaElement
  >({
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
        parameterSchema,
        isReadingSchemaFile,
        parameterUiSchema,
        isReadingUiSchemaFile,
      }}
    >
      {children}
    </StepDetailsContext.Provider>
  );
};
