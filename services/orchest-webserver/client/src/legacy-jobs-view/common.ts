import { JobData } from "@/types";
import { checkGate } from "@/utils/webserver-utils";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const requestCreateJob = async (
  projectUuid: string,
  newJobName: string,
  pipelineUuid: string,
  pipelineName: string
) => {
  await checkGate(projectUuid);
  return fetcher<JobData>("/catch/api-proxy/api/jobs", {
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
};
