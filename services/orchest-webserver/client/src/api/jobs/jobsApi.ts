import {
  JobChangesData,
  JobData,
  Json,
  PipelineJson,
  StrategyJson,
} from "@/types";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import { filesApi } from "../files/fileApi";

const BASE_URL = "/catch/api-proxy/api/jobs";

const fetchAll = async (
  projectUuid?: string | undefined
): Promise<JobData[]> => {
  return fetcher<{ jobs: JobData[] }>(
    BASE_URL + "?" + queryArgs(prune({ projectUuid }))
  ).then((response) => response.jobs);
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

  return await fetcher<JobData>(join(BASE_URL, jobUuid) + queryString);
};

const post = (
  projectUuid: string,
  pipelineUuid: string,
  pipelineName: string,
  newJobName: string
) =>
  fetcher<JobData>(BASE_URL, {
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
      parameters: [{}],
      max_retained_pipeline_runs: 250,
    }),
  });

const put = async ({ uuid, schedule, ...changes }: JobChangesData) => {
  await fetcher(join(BASE_URL, uuid), {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify({ ...changes, cron_schedule: schedule }),
  });
  return changes;
};

const putJobPipelineUuid = (jobUuid: string, pipelineUuid: string) => {
  return fetcher(join(BASE_URL, jobUuid, "pipeline"), {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify({ pipeline_uuid: pipelineUuid }),
  });
};

const deleteJob = (jobUuid: string) =>
  fetcher(join(BASE_URL, "cleanup", jobUuid), { method: "DELETE" });

const cancelJob = (jobUuid: string) =>
  fetcher(join(BASE_URL, jobUuid), { method: "DELETE" });

const resumeCronJob = (jobUuid: string) =>
  fetcher<{ next_scheduled_time: string }>(
    join(BASE_URL, "cronjobs", "resume", jobUuid),
    { method: "POST" }
  );

const pauseCronJob = (jobUuid: string) =>
  fetcher(join(BASE_URL, "cronjobs", "pause", jobUuid), { method: "POST" });

const duplicate = (jobUuid: string) =>
  fetcher<JobData>(join(BASE_URL, "duplicate"), {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ job_uuid: jobUuid }),
  });

const triggerScheduledRuns = (jobUuid: string) =>
  fetcher<{ next_scheduled_time: string }>(
    join(BASE_URL, jobUuid, "runs", "trigger"),
    { method: "POST" }
  );

type ParamConfig = Record<string, Record<string, string>>;

const fetchParamConfig = (
  projectUuid: string,
  pipelineUuid: string,
  jobUuid: string,
  path: string
) =>
  filesApi
    .readFile({
      projectUuid,
      pipelineUuid,
      jobUuid,
      path,
    })
    .then((data) => JSON.parse(data) as ParamConfig);

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
