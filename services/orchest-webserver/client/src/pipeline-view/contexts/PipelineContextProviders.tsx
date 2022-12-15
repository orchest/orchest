import React from "react";
import { CanvasScalingProvider } from "./CanvasScalingContext";
import { FileManagerLocalContextProvider } from "./FileManagerLocalContext";
import { PipelineCanvasContextProvider } from "./PipelineCanvasContext";
import { PipelineDataContextProvider } from "./PipelineDataContext";
import { PipelineRefsProvider } from "./PipelineRefsContext";
import { PipelineUiStateContextProvider } from "./PipelineUiStateContext";
import { ProjectFileManagerContextProvider } from "./ProjectFileManagerContext";

export const PipelineContextProviders: React.FC = ({ children }) => {
  return (
    <PipelineRefsProvider>
      <FileManagerLocalContextProvider>
        <CanvasScalingProvider>
          <PipelineDataContextProvider>
            <PipelineUiStateContextProvider>
              <ProjectFileManagerContextProvider>
                <PipelineCanvasContextProvider>
                  {children}
                </PipelineCanvasContextProvider>
              </ProjectFileManagerContextProvider>
            </PipelineUiStateContextProvider>
          </PipelineDataContextProvider>
        </CanvasScalingProvider>
      </FileManagerLocalContextProvider>
    </PipelineRefsProvider>
  );
};
