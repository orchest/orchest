import React from "react";
import { InteractiveRunsContextProvider } from "./InteractiveRunsContext";
import { PipelineCanvasContextProvider } from "./PipelineCanvasContext";
import { PipelineCanvasDimensionsContextProvider } from "./PipelineCanvasDimensionsContext";
import { PipelineDataContextProvider } from "./PipelineDataContext";
import { PipelineRefsProvider } from "./PipelineRefsContext";
import { PipelineUiStateContextProvider } from "./PipelineUiStateContext";
import { ProjectFileManagerContextProvider } from "./ProjectFileManagerContext";
import { ScaleFactorProvider } from "./ScaleFactorContext";

export const PipelineContextProviders: React.FC = ({ children }) => {
  return (
    <PipelineRefsProvider>
      <ScaleFactorProvider>
        <PipelineCanvasDimensionsContextProvider>
          <PipelineDataContextProvider>
            <PipelineUiStateContextProvider>
              <ProjectFileManagerContextProvider>
                <InteractiveRunsContextProvider>
                  <PipelineCanvasContextProvider>
                    {children}
                  </PipelineCanvasContextProvider>
                </InteractiveRunsContextProvider>
              </ProjectFileManagerContextProvider>
            </PipelineUiStateContextProvider>
          </PipelineDataContextProvider>
        </PipelineCanvasDimensionsContextProvider>
      </ScaleFactorProvider>
    </PipelineRefsProvider>
  );
};
