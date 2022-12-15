import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";
import { useFileManagerState } from "./useFileManagerState";

export const useExpandedFiles = () => {
  const expanded = useFileManagerState((state) => state.expanded);
  const initFileState = useFileManagerState((state) => state.init);
  const { projectUuid } = useCustomRoute();

  React.useEffect(() => {
    if (!projectUuid) return;
    initFileState(projectUuid);
  }, [initFileState, projectUuid]);

  return expanded;
};
