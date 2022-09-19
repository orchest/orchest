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

  React.useEffect(() => {
    setPipelineSaveStatus(ongoingSaves > 0 ? "saving" : "saved");
  }, [ongoingSaves, setPipelineSaveStatus]);

  return setOngoingSaves;
};
