import type { SWRResponse } from "swr";

export type TUseProjectsOptions = {
  shouldFetch?: boolean;
};

type TProjectsResponse = {
  environment_count: number;
  path: string;
  pipeline_count: number;
  uuid: string;
}[];

type TProjectsError = {
  message: string;
};

export type TUseProjectsReturn = SWRResponse<TProjectsResponse, TProjectsError>;
