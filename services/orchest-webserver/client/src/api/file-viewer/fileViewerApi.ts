import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = "/async/file-viewer/";

type ViewFileParams = {
  projectUuid: string;
  pipelineUuid: string;
  stepUuid: string;
  jobUuid?: string;
  runUuid?: string;
};

export type StepFile = {
  filename: string;
  ext: string;
  step_title: string;
  content: string;
};

export const fetchOne = ({
  projectUuid,
  pipelineUuid,
  stepUuid,
  runUuid: pipelineRunUuid,
  ...query
}: ViewFileParams) =>
  fetcher<StepFile>(
    join(BASE_URL, projectUuid, pipelineUuid, stepUuid) +
      "?" +
      queryArgs(prune({ ...query, pipelineRunUuid }))
  );

export const fileViewerApi = { fetchOne };
