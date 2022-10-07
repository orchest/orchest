import { PipelineJson, PipelineRun } from "@/types";
import { join } from "@/utils/path";
import { queryArgs } from "@/utils/text";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const PIPELINE_RUN_STATUS_ENDPOINT = "/catch/api-proxy/api/runs";

export type StepStatusQuery = {
  projectUuid: string;
  stepUuids: string[];
  pipelineDefinition: PipelineJson;
  type: RunStepsType;
};

export type RunStepsType = "selection" | "incoming";

const runSteps = ({
  projectUuid,
  stepUuids,
  pipelineDefinition,
  type,
}: StepStatusQuery) =>
  fetcher<PipelineRun>(PIPELINE_RUN_STATUS_ENDPOINT, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      project_uuid: projectUuid,
      run_type: type,
      uuids: stepUuids,
      pipeline_definition: pipelineDefinition,
    }),
  });

const cancel = (runUuid: string) =>
  fetcher<void>(join(PIPELINE_RUN_STATUS_ENDPOINT, runUuid), {
    method: "DELETE",
  });

const fetchAll = (projectUuid: string, pipelineUuid: string) =>
  fetcher<{ runs: PipelineRun[] }>(
    PIPELINE_RUN_STATUS_ENDPOINT +
      "?" +
      queryArgs({ projectUuid, pipelineUuid })
  ).then((data) => data.runs);

const fetchOne = (runUuid: string) =>
  fetcher<PipelineRun>(join(PIPELINE_RUN_STATUS_ENDPOINT, runUuid));

export const pipelineRunsApi = {
  fetchAll,
  fetchOne,
  runSteps,
  cancel,
};
