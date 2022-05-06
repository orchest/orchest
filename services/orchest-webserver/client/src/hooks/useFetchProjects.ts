import { Project } from "@/types";
import { toQueryString } from "@/utils/routing";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";

export const useFetchProjects = (params?: {
  shouldFetch?: boolean;
  sessionCounts?: boolean;
  jobCounts?: boolean;
  skipDiscovery?: boolean;
}) => {
  const { shouldFetch, ...restParams } = hasValue(params)
    ? { shouldFetch: true, ...params }
    : { shouldFetch: true };

  const cacheKey = `/async/projects${toQueryString(restParams)}`;

  const {
    data,
    mutate,
    error: fetchProjectsError,
    isValidating: isFetchingProjects,
  } = useSWR<Project[]>(shouldFetch ? cacheKey : null, fetcher);

  const setProjects = React.useCallback(
    (data?: Project[] | Promise<Project[]> | MutatorCallback<Project[]>) =>
      mutate(data, false),
    [mutate]
  );

  return {
    projects: data,
    fetchProjectsError,
    isFetchingProjects,
    fetchProjects: mutate,
    setProjects,
  };
};
