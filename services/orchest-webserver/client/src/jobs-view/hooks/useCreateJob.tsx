import { useJobsApi } from "@/api/jobs/useJobsApi";
import RouteLink from "@/components/RouteLink";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { JobData, PipelineMetaData } from "@/types";
import { getUniqueName } from "@/utils/getUniqueName";
import { queryArgs } from "@/utils/text";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useCreateJob = (pipeline: PipelineMetaData | undefined) => {
  const { setAlert, deletePromptMessage } = useGlobalContext();
  const {
    state: { pipelines },
  } = useProjectsContext();
  const { projectUuid } = useCustomRoute();
  const { name, uuid: pipelineUuid } = pipeline || {};

  const jobs = useJobsApi((state) => state.jobs || []);
  const post = useJobsApi((state) => state.post);

  const newJobName = React.useMemo(() => {
    return getUniqueName(
      "Job",
      jobs.map((job) => job.name)
    );
  }, [jobs]);

  const { run, status } = useAsync<JobData | undefined>();

  const isAllowedToCreateJob =
    status !== "PENDING" && hasValue(pipelineUuid) && hasValue(name);

  const createJob = React.useCallback(async () => {
    if (isAllowedToCreateJob) {
      try {
        const newJob = await run(post(pipelineUuid, name, newJobName));
        return newJob;
      } catch (error) {
        if (typeof error.message !== "string") {
          setAlert("Notice", "Unable to create a new Job. Please try again.");
          return;
        }
        // TODO: Improve BE returned error.
        const invalidPipelines = (error.message as string).split(",");
        const hasMultiple = invalidPipelines.length > 0;
        setAlert(
          "Notice",
          <>
            <Typography sx={{ marginBottom: (theme) => theme.spacing(2) }}>
              {`Unable to create a new Job. The following Pipeline${
                hasMultiple ? "s" : ""
              } contain${
                hasMultiple ? "" : "s"
              } Steps or Services with an invalid Environment. Please make sure all Pipeline Steps and Services are assigned an 
              Environment that exists in the Project.`}
            </Typography>
            <Stack direction="column">
              {invalidPipelines.map((pipelineUuid) => {
                const url = `${siteMap.pipeline.path}?${queryArgs({
                  projectUuid,
                  pipelineUuid,
                })}`;
                const pipeline = pipelines?.find(
                  (pipeline) => pipeline.uuid === pipelineUuid
                );
                return (
                  <RouteLink
                    key={pipelineUuid}
                    underline="none"
                    to={url}
                    onClick={deletePromptMessage}
                  >
                    {pipeline?.path}
                  </RouteLink>
                );
              })}
            </Stack>
          </>
        );
      }
    }
  }, [
    post,
    isAllowedToCreateJob,
    pipelineUuid,
    name,
    newJobName,
    run,
    setAlert,
    pipelines,
    projectUuid,
    deletePromptMessage,
  ]);

  return { createJob, isAllowedToCreateJob };
};
