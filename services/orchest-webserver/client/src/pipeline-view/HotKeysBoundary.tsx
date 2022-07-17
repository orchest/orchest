import React from "react";
import { useHotKeysInPipelineEditor } from "./hooks/useHotKeysInPipelineEditor";

export const HotKeysBoundary: React.FC = ({ children }) => {
  const { disableHotKeys, enableHotKeys } = useHotKeysInPipelineEditor();
  return (
    <div
      className="pane pipeline-view-pane"
      onMouseOver={enableHotKeys}
      onMouseLeave={disableHotKeys}
    >
      {children}
    </div>
  );
};
