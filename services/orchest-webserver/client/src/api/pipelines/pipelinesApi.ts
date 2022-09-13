import { PipelineData } from "@/types";
import { join } from "@/utils/path";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = "/async/pipelines/";

const fetchOne = (projectUuid: string, pipelineUuid: string) =>
  fetcher<PipelineData>(join(BASE_URL, projectUuid, pipelineUuid));

export const pipelinesApi = { fetchOne };
