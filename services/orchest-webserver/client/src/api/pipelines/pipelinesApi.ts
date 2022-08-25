import { PipelineData, PipelineMetaData } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";

const fetch = async (
  projectUuid: string,
  pipelineUuid: string
): Promise<PipelineData> => {
  return fetcher<PipelineData>(
    `/async/pipelines/${projectUuid}/${pipelineUuid}`
  );
};

const fetchInProject = async (
  projectUuid: string
): Promise<PipelineMetaData[]> => {
  return fetcher<{ result: PipelineMetaData[] }>(
    `/async/pipelines/${projectUuid}`
  ).then((response) => response.result);
};

const fetchAll = async (): Promise<
  (PipelineMetaData & { project_uuid: string })[]
> => {
  return fetcher<{ result: (PipelineMetaData & { project_uuid: string })[] }>(
    "/async/pipelines"
  ).then((response) => response.result);
};

const post = (projectUuid: string, path: string, name = "") =>
  fetcher<{ pipeline_uuid: string }>(`/async/pipelines/create/${projectUuid}`, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ name, pipeline_path: path }),
  }).then((response) => response.pipeline_uuid);

const put = (
  projectUuid: string,
  pipelineUuid: string,
  changes: Partial<PipelineData>
) =>
  fetcher<{ success: boolean; reason?: string; message?: string }>(
    `/async/pipelines/${projectUuid}/${pipelineUuid}`,
    {
      method: "PUT",
      headers: HEADER.JSON,
      body: JSON.stringify(changes),
    }
  );

const remove = (projectUuid: string, pipelineUuid: string) =>
  fetcher(`/async/pipelines/${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });

export const pipelinesApi = {
  fetch,
  fetchInProject,
  fetchAll,
  post,
  put,
  delete: remove,
};
