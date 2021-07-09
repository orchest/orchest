import useSWR from "swr";
import { fetcher } from "@/utils/fetcher";

export type TUseProjectsOptions = {
  shouldFetch?: boolean;
};

export type TUseProjectsResponse = {
  environment_count: number;
  path: string;
  pipeline_count: number;
  uuid: string;
}[];

export type TUseProjectsError = {
  message: string;
};

export const useProjects = ({ shouldFetch }: TUseProjectsOptions) => {
  const { data, error, ...swr } = useSWR<
    TUseProjectsResponse,
    TUseProjectsError
  >(shouldFetch === false ? null : "/async/projects", fetcher);

  return { isLoading: !data && !error, data, error, ...swr };
};
