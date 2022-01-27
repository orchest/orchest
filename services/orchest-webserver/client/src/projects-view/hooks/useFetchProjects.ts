import { toQueryString } from "@/Routes";
import { Project } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";

export const useFetchProjects = (params?: {
  sessionCounts: boolean;
  jobCounts: boolean;
}) => {
  const {
    data: projects = [],
    mutate,
    error: fetchProjectsError,
    isValidating: isFetchingProjects,
  } = useSWR<Project[]>(`/async/projects${toQueryString(params)}`, fetcher);

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
