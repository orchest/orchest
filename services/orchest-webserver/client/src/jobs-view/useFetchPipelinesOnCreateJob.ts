import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
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
    state: { pipelines: pipelinesInState, projectUuid },
  } = useProjectsContext();
  const { setConfirm } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const { pipelines: fetchedPipelines } = useFetchPipelines(
    isCreateDialogOpen && !pipelinesInState && projectUuid
      ? projectUuid
      : undefined
  );

  const pipelines = pipelinesInState || fetchedPipelines;

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
