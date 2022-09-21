import React from "react";
import { FileManagerContextProvider } from "../file-manager/FileManagerContext";
import { usePipelineDataContext } from "./PipelineDataContext";

export const ProjectFileManagerContextProvider: React.FC = ({ children }) => {
  const {
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  } = usePipelineDataContext();

  return (
    <FileManagerContextProvider
      projectUuid={projectUuid}
      pipelineUuid={pipelineUuid}
      jobUuid={jobUuid}
      runUuid={runUuid}
    >
      {children}
    </FileManagerContextProvider>
  );
};
