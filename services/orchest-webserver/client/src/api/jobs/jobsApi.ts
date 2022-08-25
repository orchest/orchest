import { JobData } from "@/types";
import { queryArgs } from "@/utils/text";
import { fetcher, HEADER } from "@orchest/lib-utils";

const fetchAll = async (projectUuid: string): Promise<JobData[]> => {
  const unsortedJobs = await fetcher<{ jobs: JobData[] }>(
    `/catch/api-proxy/api/jobs?${queryArgs({ projectUuid })}`
  ).then((response) => response.jobs);
  return unsortedJobs.sort((a, b) => -1 * a.name.localeCompare(b.name));
};

const post = (
  projectUuid: string,
  pipelineUuid: string,
  pipelineName: string,
  newJobName: string
) =>
  fetcher<JobData>("/catch/api-proxy/api/jobs/", {
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

export const jobsApi = {
  fetchAll,
  post,
};
