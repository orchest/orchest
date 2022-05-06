import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

export const useFetchPipelinesOnCreateJob = ({
  isCreateDialogOpen,
  closeCreateDialog,
}: {
  isCreateDialogOpen: boolean;
  closeCreateDialog: () => void;
}) => {
  const {
    state: { pipelines },
  } = useProjectsContext();
  const { setConfirm } = useAppContext();
  const { navigateTo, projectUuid } = useCustomRoute();

  React.useEffect(() => {
    if (isCreateDialogOpen && pipelines?.length === 0) {
      closeCreateDialog();
      setConfirm(
        "Warning",
        "No pipeline found in this project. You need a pipeline to start with.",
        (resolve) => {
          navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
          resolve(true);
          return true;
        }
      );
    }
  }, [
    setConfirm,
    closeCreateDialog,
    isCreateDialogOpen,
    pipelines,
    navigateTo,
    projectUuid,
  ]);

  return pipelines;
};
