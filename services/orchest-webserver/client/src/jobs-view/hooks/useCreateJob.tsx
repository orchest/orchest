import { useJobsApi } from "@/api/jobs/useJobsApi";
import { RouteLink } from "@/components/RouteLink";
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

type InvalidEnvironmentsErrorProps = {
  invalidPipelines: string[];
};

const InvalidEnvironmentsError = ({
  invalidPipelines,
}: InvalidEnvironmentsErrorProps) => {
  const {
    state: { pipelines },
  } = useProjectsContext();
  const { projectUuid } = useCustomRoute();
  const { deletePromptMessage } = useGlobalContext();
  const hasMultiple = invalidPipelines.length > 0;
  return (
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
};

export const useCreateJob = (pipeline: PipelineMetaData | undefined) => {
  const { setAlert } = useGlobalContext();
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
        const invalidPipelines: string[] | undefined =
          error.body?.invalid_pipelines;
        if (!invalidPipelines) {
          setAlert("Notice", "Unable to create a new Job. Please try again.");
          return;
        }
        setAlert(
          "Notice",
          <InvalidEnvironmentsError invalidPipelines={invalidPipelines} />
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
  ]);

  return { createJob, isAllowedToCreateJob };
};
