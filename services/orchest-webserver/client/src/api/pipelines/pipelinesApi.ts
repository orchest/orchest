import { PipelineMetaData, PipelineState } from "@/types";
import { join } from "@/utils/path";
import { fetcher } from "@orchest/lib-utils";

type PipelinesResponse = { result: PipelineMetaData[] };

const BASE_URL = "/async/pipelines";

const fetchAll = () =>
  fetcher<PipelinesResponse>(BASE_URL).then((data) => data.result);

const fetchForProject = (projectUuid: string) =>
  fetcher<PipelinesResponse>(join(BASE_URL, projectUuid)).then(
    (data) => data.result
  );

/** Fetches the state of a single pipeline. */
const fetchState = (projectUuid: string, pipelineUuid: string) =>
  fetcher<PipelineState>(join(BASE_URL, projectUuid, pipelineUuid));

const deletePipeline = (projectUuid: string, pipelineUuid: string) =>
  fetcher(join(BASE_URL, projectUuid, pipelineUuid), { method: "DELETE" });

export const pipelinesApi = {
  fetchState,
  fetchAll,
  fetchForProject,
  deletePipeline,
};
