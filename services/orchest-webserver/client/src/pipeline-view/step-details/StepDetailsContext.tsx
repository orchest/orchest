import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { PipelineStepState } from "@/types";
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
};

export const StepDetailsContext = React.createContext<StepDetailsContextType>(
  {} as StepDetailsContextType
);

export const useStepDetailsContext = () => React.useContext(StepDetailsContext);
export const StepDetailsContextProvider: React.FC = ({ children }) => {
  const { projectUuid, jobUuid } = useCustomRoute();
  const { pipelineUuid, runUuid } = usePipelineDataContext();
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
      }}
    >
      {children}
    </StepDetailsContext.Provider>
  );
};
