import { useProjectsContext } from "@/contexts/ProjectsContext";
import React from "react";

export const useSavingIndicator = () => {
  const [ongoingSaves, setOngoingSaves] = React.useState(0);
  const { dispatch } = useProjectsContext();

  const setPipelineSaveStatus = React.useCallback(
    (status: "saving" | "saved") => {
      dispatch({
        type: "SET_PIPELINE_SAVE_STATUS",
        payload: status,
      });
    },
    [dispatch]
  );

  const timeoutRef = React.useRef<number>();

  React.useEffect(() => {
    window.clearTimeout(timeoutRef.current);
    if (ongoingSaves > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setPipelineSaveStatus("saving");
      }, 100);
    }
    if (ongoingSaves === 0) {
      setPipelineSaveStatus("saved");
    }
  }, [ongoingSaves, setPipelineSaveStatus]);

  return setOngoingSaves;
};
