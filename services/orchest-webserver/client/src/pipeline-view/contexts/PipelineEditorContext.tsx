import { useForceUpdate } from "@/hooks/useForceUpdate";
import React from "react";
import { usePipelineDataContext } from "./PipelineDataContext";
import { usePipelineRefs } from "./PipelineRefsContext";
import { usePipelineUiStateContext } from "./PipelineUiStateContext";

export type PipelineEditorContextType = {
  isContextMenuOpen: boolean;
  setIsContextMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const PipelineEditorContext = React.createContext<PipelineEditorContextType | null>(
  null
);

export const usePipelineEditorContext = () => {
  const context = React.useContext(PipelineEditorContext);
  if (context === null) throw new Error("Context not initialized.");
  return context;
};

export const PipelineEditorContextProvider: React.FC = ({ children }) => {
  const { isReadOnly } = usePipelineDataContext();
  const { stepRefs } = usePipelineRefs();
  const { uiState } = usePipelineUiStateContext();

  // in read-only mode, PipelineEditor doesn't re-render after stepDomRefs collects all DOM elements of the steps
  // we need to force re-render one more time to show the connection lines
  const shouldForceRerender =
    isReadOnly &&
    uiState.connections.length > 0 &&
    Object.keys(stepRefs.current).length === 0;

  const [, forceUpdate] = useForceUpdate();

  const [isContextMenuOpen, setIsContextMenuOpen] = React.useState(false);

  React.useLayoutEffect(() => {
    if (shouldForceRerender) forceUpdate();
  }, [shouldForceRerender, forceUpdate]);

  return (
    <PipelineEditorContext.Provider
      value={{
        isContextMenuOpen,
        setIsContextMenuOpen,
      }}
    >
      {children}
    </PipelineEditorContext.Provider>
  );
};
