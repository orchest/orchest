import { toQueryString } from "@/Routes";
import { Project } from "@/types";
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

  const {
    data: projects = [],
    mutate,
    error: fetchProjectsError,
    isValidating: isFetchingProjects,
  } = useSWR<Project[]>(
    shouldFetch ? `/async/projects${toQueryString(restParams)}` : null,
    fetcher
  );

  const setProjects = React.useCallback(
    (data?: Project[] | Promise<Project[]> | MutatorCallback<Project[]>) =>
      mutate(data, false),
    [mutate]
  );

  return {
    projects,
    fetchProjectsError,
    isFetchingProjects,
    fetchProjects: mutate,
    setProjects,
  };
};
