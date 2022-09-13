import { FILE_MANAGEMENT_ENDPOINT } from "@/pipeline-view/file-manager/common";
import {
  JobChangesData,
  JobData,
  Json,
  PipelineJson,
  StrategyJson,
} from "@/types";
import { queryArgs } from "@/utils/text";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";

const fetchAll = async (projectUuid: string): Promise<JobData[]> => {
  const unsortedJobs = await fetcher<{ jobs: JobData[] }>(
    `/catch/api-proxy/api/jobs?${queryArgs({ projectUuid })}`
  ).then((response) => response.jobs);
  return unsortedJobs.sort((a, b) => -1 * a.name.localeCompare(b.name));
};

const fetchOne = async (
  jobUuid: string,
  aggregateRunStatuses?: boolean
): Promise<JobData> => {
  const queryString = hasValue(aggregateRunStatuses)
    ? `?${queryArgs({
        aggregateRunStatuses,
      })}`
    : "";
  const job = await fetcher<JobData>(
    `/catch/api-proxy/api/jobs/${jobUuid}${queryString}`
  );

  return job;
};

const post = (
  projectUuid: string,
  pipelineUuid: string,
  pipelineName: string,
  newJobName: string
) =>
  fetcher<JobData>("/catch/api-proxy/api/jobs", {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      pipeline_uuid: pipelineUuid,
      project_uuid: projectUuid,
      pipeline_name: pipelineName, // ? Question: why pipeline_name is needed when pipeline_uuid is given?
      name: newJobName,
      draft: true,
      pipeline_run_spec: {
        run_type: "full",
        uuids: [],
      },
      parameters: [],
    }),
  });

const put = async ({ uuid, schedule, ...changes }: JobChangesData) => {
  await fetcher(`/catch/api-proxy/api/jobs/${uuid}`, {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify({ ...changes, cron_schedule: schedule }),
  });
  return changes;
};

const putJobPipelineUuid = (jobUuid: string, pipelineUuid: string) => {
  return fetcher(`/catch/api-proxy/api/jobs/${jobUuid}/pipeline`, {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify({ pipeline_uuid: pipelineUuid }),
  });
};

const deleteJob = (jobUuid: string) =>
  fetcher(`/catch/api-proxy/api/jobs/cleanup/${jobUuid}`, {
    method: "DELETE",
  });

const cancelJob = (jobUuid: string) =>
  fetcher(`/catch/api-proxy/api/jobs/${jobUuid}`, {
    method: "DELETE",
  });

const resumeCronJob = (jobUuid: string) =>
  fetcher<{ next_scheduled_time: string }>(
    `/catch/api-proxy/api/jobs/cronjobs/resume/${jobUuid}`,
    { method: "POST" }
  );

const pauseCronJob = (jobUuid: string) =>
  fetcher(`/catch/api-proxy/api/jobs/cronjobs/pause/${jobUuid}`, {
    method: "POST",
  });

const duplicate = (jobUuid: string) =>
  fetcher<JobData>("/catch/api-proxy/api/jobs/duplicate", {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ job_uuid: jobUuid }),
  });

const triggerScheduledRuns = (jobUuid: string) =>
  fetcher<{ next_scheduled_time: string }>(
    `/catch/api-proxy/api/jobs/${jobUuid}/runs/trigger`,
    { method: "POST" }
  );

type ParamConfig = Record<string, Record<string, string>>;

// TODO: Move this to future fileManagerApi implementation.
const fetchParamConfig = (
  projectUuid: string,
  pipelineUuid: string,
  jobUuid: string,
  path: string
) =>
  fetcher<ParamConfig>(
    `${FILE_MANAGEMENT_ENDPOINT}/read?${queryArgs({
      projectUuid,
      pipelineUuid,
      jobUuid,
      path,
    })}`
  );

const toStringifiedParams = (params: Record<string, Json>, wrap?: boolean) => {
  return Object.entries(params).reduce((all, [paramKey, value]) => {
    return { ...all, [paramKey]: JSON.stringify(wrap ? [value] : value) };
  }, {} as Record<string, string>);
};

const generateStrategyJsonFromParamJsonFile = (
  paramJson: Record<string, Record<string, string>>,
  pipeline: PipelineJson,
  reservedKey: string
): StrategyJson => {
  const strategyJson = Object.entries(paramJson).reduce((all, [key, value]) => {
    let stringifiedParams = toStringifiedParams(value);
    const newValue = {
      parameters: stringifiedParams,
      key,
    };

    if (key === reservedKey) {
      try {
        newValue["title"] = pipeline.name;
      } catch (error) {
        console.error(error);
      }
    } else {
      try {
        newValue["title"] = pipeline.steps[key].title;
      } catch {
        // Missing pipeline step entries
        // will be deleted in filtering step below.
      }
    }

    return {
      ...all,
      [key]: newValue,
    };
  }, {} as StrategyJson);

  // Fill in missing values
  Object.keys(pipeline.steps).forEach((stepUuid) => {
    let step = pipeline.steps[stepUuid];
    if (step.parameters && Object.keys(step.parameters).length > 0) {
      let stepParametersFromPipelineStepDef = toStringifiedParams(
        step.parameters,
        true
      );
      if (!strategyJson[stepUuid]) {
        strategyJson[stepUuid] = {
          key: stepUuid,
          title: step.title,
          parameters: stepParametersFromPipelineStepDef,
        };
      } else {
        strategyJson[stepUuid].parameters = {
          ...stepParametersFromPipelineStepDef,
          ...strategyJson[stepUuid].parameters,
        };
      }
    }
  });

  Object.keys(strategyJson).forEach((key) => {
    if (key !== reservedKey) {
      // For pipeline step keys in strategyJson, filter step UUIDs that aren't
      // in the pipeline definition.
      if (!Object.keys(pipeline.steps).includes(key)) {
        delete strategyJson[key];
      }
    }
  });

  // Check for missing pipeline parameters
  let pipelineParametersFromPipelineDef = toStringifiedParams(
    pipeline.parameters || {},
    true
  );
  if (strategyJson[reservedKey] === undefined) {
    strategyJson[reservedKey] = {
      key: reservedKey,
      title: pipeline.name,
      parameters: pipelineParametersFromPipelineDef,
    };
  } else if (Object.keys(pipeline.parameters).length > 0) {
    strategyJson[reservedKey].parameters = {
      ...pipelineParametersFromPipelineDef,
      ...strategyJson[reservedKey].parameters,
    };
  }

  return strategyJson;
};

const fetchStrategyJson = async ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  pipelineJson,
  paramFilePath,
  reservedKey,
}: {
  projectUuid: string;
  pipelineUuid: string;
  jobUuid: string;
  pipelineJson: PipelineJson;
  paramFilePath?: string;
  reservedKey: string | undefined;
}) => {
  if (!paramFilePath || !reservedKey) return;

  try {
    const paramConfig = await fetchParamConfig(
      projectUuid,
      pipelineUuid,
      jobUuid,
      paramFilePath
    );

    const strategyJson = generateStrategyJsonFromParamJsonFile(
      paramConfig,
      pipelineJson,
      reservedKey
    );

    return strategyJson;
  } catch (error) {
    if (error.status !== 404) {
      console.error(error);
    }
  }
};

export const jobsApi = {
  fetchAll,
  fetchOne,
  post,
  put,
  putJobPipelineUuid,
  delete: deleteJob,
  cancel: cancelJob,
  resumeCronJob,
  pauseCronJob,
  duplicate,
  triggerScheduledRuns,
  fetchStrategyJson,
};
