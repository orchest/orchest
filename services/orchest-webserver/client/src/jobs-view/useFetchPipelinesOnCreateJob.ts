import { AlertDispatcher } from "@/contexts/AppContext";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { siteMap } from "@/routingConfig";
import React from "react";

export const useFetchPipelinesOnCreateJob = ({
  projectUuid,
  isCreateDialogOpen,
  navigateTo,
  setAlert,
  closeCreateDialog,
}: {
  projectUuid: string;
  isCreateDialogOpen: boolean;
  navigateTo: (path: string) => void;
  setAlert: AlertDispatcher;
  closeCreateDialog: () => void;
}) => {
  const { pipelines, isFetchingPipelines, error } = useFetchPipelines(
    projectUuid,
    isCreateDialogOpen
  );
  React.useEffect(() => {
    if (error && error.status === 404) navigateTo(siteMap.projects.path);
  }, [error, navigateTo]);
  // when opening create job dialog, check if there's any pipeline
  // if not, show an alert
  React.useEffect(() => {
    const isPipelineFetched =
      isCreateDialogOpen && !isFetchingPipelines && pipelines;

    if (isPipelineFetched && pipelines.length === 0) {
      closeCreateDialog();
      setAlert("Error", "Could not find any pipelines for this project.");
    }
  }, [
    setAlert,
    closeCreateDialog,
    isCreateDialogOpen,
    isFetchingPipelines,
    pipelines,
  ]);

  return pipelines;
};
