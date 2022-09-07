import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useReadFile } from "@/hooks/useReadFile";
import { StepsDict, StepState } from "@/types";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import { ALLOWED_STEP_EXTENSIONS } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

/** Represents all the connection a single step has. */
export type StepConnection = {
  targetUuid: string;
  title: string;
  filePath: string;
  direction: "incoming" | "outgoing";
};

export type StepDetailsContextType = {
  doesStepFileExist: boolean;
  isCheckingFileValidity: boolean;
  step: StepState;
  connections: StepConnection[];
  disconnect(startStepUUID: string, endStepUUID: string): void;
  parameterSchema?: JsonSchema;
  isReadingSchemaFile: boolean;
  parameterUiSchema?: UISchemaElement;
  isReadingUiSchemaFile: boolean;
};

export const StepDetailsContext = React.createContext<StepDetailsContextType>(
  {} as StepDetailsContextType
);

export const useStepDetailsContext = () => React.useContext(StepDetailsContext);

const toStepConnection = (
  direction: "incoming" | "outgoing",
  steps: StepsDict
) => (targetUuid: string): StepConnection => ({
  targetUuid,
  direction,
  title: steps[targetUuid].title,
  filePath: steps[targetUuid].file_path,
});

export const StepDetailsContextProvider: React.FC = ({ children }) => {
  const {
    projectUuid,
    pipelineUuid,
    runUuid,
    jobUuid,
  } = usePipelineDataContext();
  const { uiStateDispatch, uiState } = usePipelineUiStateContext();
  const { steps, openedStep } = uiState;

  const disconnect = React.useCallback(
    (startNodeUUID: string, endNodeUUID: string) => {
      uiStateDispatch({
        type: "REMOVE_CONNECTION",
        payload: { startNodeUUID, endNodeUUID },
      });
    },
    [uiStateDispatch]
  );

  const step = steps[openedStep || ""];
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
    if (!step) return [];

    const { incoming_connections, outgoing_connections } = step;

    return incoming_connections
      .map(toStepConnection("incoming", steps))
      .concat(outgoing_connections.map(toStepConnection("outgoing", steps)));
  }, [steps, step]);

  return (
    <StepDetailsContext.Provider
      value={{
        disconnect,
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
